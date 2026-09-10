import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  esFondoValido,
  fondoHistoricoConfigurado,
  filaAModelo,
  parseDumpFondo,
  type CuerpoIngesta,
} from "@/lib/fondo-historico";

/**
 * Ingesta del Fondo Documental histórico. La llama el extractor que corre
 * DENTRO de la red CDMB (scripts/fondo-historico/), porque el Oracle origen
 * no es alcanzable desde Vercel.
 *
 * Autorización: `Authorization: Bearer <FONDO_INGEST_TOKEN>`.
 *
 * Protocolo (una corrida):
 *   1. POST { fondo, disparadoPor }                       → crea la corrida, devuelve { sincronizacionId }
 *   2. POST datos (una o varias veces)                    → upsert de un bloque de documentos
 *   3. POST { fondo, sincronizacionId, finalizar: true }  → borra lo no tocado y cierra la corrida
 *
 * Paso 2 — dos formatos:
 *  a) JSON: `{ fondo, sincronizacionId, lote: FilaFondoEntrada[] }`
 *  b) "dump" de sqlplus (Oracle 10g no puede generar JSON sin romperlo): cuerpo
 *     de texto con marcas por línea, y las cabeceras `X-Fondo`, `X-Sync`,
 *     `X-Serie`, `X-Serie-Nombre` (base64). Marcas:
 *        #<ref_id>      nuevo documento
 *        @<COLUMNA>     empieza un campo
 *        =<trozo>       (0..n) contenido del campo
 *     Columnas especiales: `__NARCH__` → nº de archivos, `__RUTA__` → ruta.
 *
 * Es idempotente por documento (upsert por `id`). Si la corrida se corta antes
 * del paso 3, no se borra nada: la siguiente corrida completa el espejo.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

/** Sustituye por espacio los caracteres de control crudos (0x00–0x1F) que
 *  harían fallar JSON.parse dentro de una cadena. */
function limpiarControl(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) out += s.charCodeAt(i) < 0x20 ? " " : s[i];
  return out;
}

export async function POST(req: NextRequest) {
  const token = process.env.FONDO_INGEST_TOKEN?.trim();
  if (!fondoHistoricoConfigurado() || req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const syncHeader = req.headers.get("x-sync");
  let cuerpo: CuerpoIngesta;

  if (syncHeader) {
    // Modo "dump" de sqlplus.
    const serieId = Number(req.headers.get("x-serie")) || null;
    let serieNombre = "";
    try {
      serieNombre = Buffer.from(req.headers.get("x-serie-nombre") ?? "", "base64").toString("utf8");
    } catch {
      /* nombre opcional */
    }
    cuerpo = {
      fondo: req.headers.get("x-fondo") ?? "",
      sincronizacionId: syncHeader,
      lote: parseDumpFondo(limpiarControl(await req.text()), serieId, serieNombre),
    };
  } else {
    try {
      cuerpo = JSON.parse(limpiarControl(await req.text())) as CuerpoIngesta;
    } catch (e) {
      return NextResponse.json(
        { error: "JSON inválido.", detalle: e instanceof Error ? e.message : String(e) },
        { status: 400 },
      );
    }
  }

  const { fondo } = cuerpo;
  if (!fondo || !esFondoValido(fondo)) {
    return NextResponse.json({ error: `Fondo desconocido: ${fondo}` }, { status: 400 });
  }

  // Paso 1 — abrir la corrida.
  if (!cuerpo.sincronizacionId) {
    const sync = await db.fondoSincronizacion.create({
      data: {
        fondo,
        totalOrigen: cuerpo.totalOrigen ?? null,
        disparadoPor: cuerpo.disparadoPor?.slice(0, 120) ?? null,
        creados: 0,
        actualizados: 0,
        eliminados: 0,
      },
    });
    return NextResponse.json({ sincronizacionId: sync.id });
  }

  const sync = await db.fondoSincronizacion.findUnique({ where: { id: cuerpo.sincronizacionId } });
  if (!sync || sync.fondo !== fondo) {
    return NextResponse.json({ error: "sincronizacionId no corresponde a este fondo." }, { status: 400 });
  }

  // Paso 3 — cerrar: borra lo que esta corrida no tocó y marca la bitácora.
  if (cuerpo.finalizar) {
    const borrados = await db.fondoDocumento.deleteMany({
      where: { fondo, sincronizacionId: { not: sync.id } },
    });
    const cerrada = await db.fondoSincronizacion.update({
      where: { id: sync.id },
      data: {
        terminadoEn: new Date(),
        ok: true,
        eliminados: borrados.count,
        totalOrigen: cuerpo.totalOrigen ?? sync.totalOrigen,
      },
    });
    revalidateTag("fondo-historico");
    return NextResponse.json({
      ok: true,
      creados: cerrada.creados,
      actualizados: cerrada.actualizados,
      eliminados: cerrada.eliminados,
    });
  }

  // Paso 2 — un bloque de documentos.
  const lote = Array.isArray(cuerpo.lote) ? cuerpo.lote : [];
  if (lote.length === 0) {
    return NextResponse.json({ recibidas: 0, creados: 0, actualizados: 0, saltadas: 0 });
  }
  if (lote.length > 2000) {
    return NextResponse.json({ error: "Bloque demasiado grande (máx. 2000)." }, { status: 413 });
  }

  const filas = lote
    .filter((f) => f && f.ref_id != null && String(f.ref_id) !== "")
    .map((f) => {
      const m = filaAModelo(fondo, f);
      return {
        ...m,
        campos: (m.campos ?? Prisma.DbNull) as Prisma.InputJsonValue,
        sincronizacionId: sync.id,
        sincronizadoEn: new Date(),
      };
    });
  const ids = filas.map((f) => f.id);
  const existentes = await db.fondoDocumento.count({ where: { id: { in: ids } } });

  await db.$transaction([
    db.fondoDocumento.deleteMany({ where: { id: { in: ids } } }),
    db.fondoDocumento.createMany({ data: filas }),
  ]);

  const creados = filas.length - existentes;
  await db.fondoSincronizacion.update({
    where: { id: sync.id },
    data: { creados: { increment: creados }, actualizados: { increment: existentes } },
  });

  return NextResponse.json({
    recibidas: filas.length,
    creados,
    actualizados: existentes,
    saltadas: lote.length - filas.length,
  });
}
