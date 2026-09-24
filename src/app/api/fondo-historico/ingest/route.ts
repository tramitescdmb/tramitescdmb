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

export const runtime = "nodejs";
export const maxDuration = 60;

function limpiarControl(s: string, conservarSalto = false): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x20) out += s[i];
    else if (conservarSalto && c === 0x0a) out += "\n";
    else out += " ";
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    return await manejar(req);
  } catch (e) {
    return NextResponse.json(
      { error: "Error interno.", detalle: e instanceof Error ? `${e.message}` : String(e) },
      { status: 500 },
    );
  }
}

async function manejar(req: NextRequest) {
  const token = process.env.FONDO_INGEST_TOKEN?.trim();
  if (!fondoHistoricoConfigurado() || req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const syncHeader = req.headers.get("x-sync");
  let cuerpo: CuerpoIngesta;

  if (syncHeader) {
    const serieId = Number(req.headers.get("x-serie")) || null;
    const serieNombre = (req.headers.get("x-serie-nombre") ?? "").trim();
    cuerpo = {
      fondo: req.headers.get("x-fondo") ?? "",
      sincronizacionId: syncHeader,
      lote: parseDumpFondo(limpiarControl(await req.text(), true), serieId, serieNombre),
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
