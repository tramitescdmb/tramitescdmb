import crypto from "crypto";
import type { AccionAuditoriaDoc } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Bitácora inalterable con cadena de hash (SGDEA / MoReq — pistas de auditoría
 * inalterables). Cada eslabón encadena su `hash` con el `hashAnterior` (el hash
 * del eslabón previo). Alterar el contenido de una fila cambia su hash y rompe
 * la cadena; borrar una fila deja el `hashAnterior` de la siguiente sin
 * coincidencia. `verificarCadena()` detecta ambos casos.
 *
 * Registra también LEE y EXPORTA — lo que la auditoría de cuenta
 * (RegistroAuditoria) no hace.
 */

export type DatosEslabon = {
  entidad: string;
  entidadId: string;
  accion: AccionAuditoriaDoc;
  usuarioId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  detalle?: string | null;
};

// Campos que entran al hash. NO se incluye `secuencia` (la asigna la base con
// autoincrement, no se conoce antes de insertar) ni el `id`: la cadena se apoya
// en `hashAnterior` + el contenido + la fecha generada en la app.
export type FilaHasheable = DatosEslabon & { createdAtIso: string; hashAnterior: string | null };

export function calcularHashAuditoria(fila: FilaHasheable): string {
  const base = [
    fila.hashAnterior ?? "",
    fila.entidad,
    fila.entidadId,
    fila.accion,
    fila.usuarioId ?? "",
    fila.ip ?? "",
    fila.detalle ?? "",
    fila.createdAtIso,
  ].join("|");
  return crypto.createHash("sha256").update(base).digest("hex");
}

/** Verificación pura sobre una lista ya ordenada por `secuencia` asc. Testeable sin base. */
export function verificarCadenaFilas(
  filas: Array<{
    secuencia: number;
    entidad: string;
    entidadId: string;
    accion: AccionAuditoriaDoc;
    usuarioId: string | null;
    ip: string | null;
    detalle: string | null;
    createdAt: Date;
    hashAnterior: string | null;
    hash: string;
  }>
): { ok: boolean; totalRevisadas: number; secuenciaRota?: number } {
  let hashPrevio: string | null = null;
  for (const f of filas) {
    if (f.hashAnterior !== hashPrevio) return { ok: false, totalRevisadas: filas.length, secuenciaRota: f.secuencia };
    const recalculado = calcularHashAuditoria({
      entidad: f.entidad,
      entidadId: f.entidadId,
      accion: f.accion,
      usuarioId: f.usuarioId,
      ip: f.ip,
      detalle: f.detalle,
      createdAtIso: f.createdAt.toISOString(),
      hashAnterior: f.hashAnterior,
    });
    if (recalculado !== f.hash) return { ok: false, totalRevisadas: filas.length, secuenciaRota: f.secuencia };
    hashPrevio = f.hash;
  }
  return { ok: true, totalRevisadas: filas.length };
}

// Constante arbitraria para el advisory lock transaccional de Postgres que
// serializa a los escritores de la bitácora (evita que dos inserciones
// concurrentes lean el mismo "último hash" y bifurquen la cadena). Es un lock
// a nivel de transacción (`xact`), compatible con el pooler en modo transacción
// de Supabase: se libera solo al COMMIT.
const LOCK_CADENA = 918273645;

export async function registrarAuditoriaDoc(datos: DatosEslabon): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_CADENA})`;
    const ultima = await tx.auditoriaDoc.findFirst({ orderBy: { secuencia: "desc" }, select: { hash: true } });
    const hashAnterior = ultima?.hash ?? null;
    const createdAt = new Date();
    const hash = calcularHashAuditoria({ ...datos, createdAtIso: createdAt.toISOString(), hashAnterior });
    await tx.auditoriaDoc.create({
      data: {
        entidad: datos.entidad,
        entidadId: datos.entidadId,
        accion: datos.accion,
        usuarioId: datos.usuarioId ?? null,
        ip: datos.ip ?? null,
        userAgent: datos.userAgent ?? null,
        detalle: datos.detalle ?? null,
        hashAnterior,
        hash,
        createdAt,
      },
    });
  });
}

export async function verificarCadena(): Promise<{ ok: boolean; totalRevisadas: number; secuenciaRota?: number }> {
  const filas = await db.auditoriaDoc.findMany({
    orderBy: { secuencia: "asc" },
    select: { secuencia: true, entidad: true, entidadId: true, accion: true, usuarioId: true, ip: true, detalle: true, createdAt: true, hashAnterior: true, hash: true },
  });
  return verificarCadenaFilas(filas);
}

/** Extrae IP y user-agent de las cabeceras de una petición, para la bitácora. */
export function datosPeticion(headers: Headers): { ip: string | null; userAgent: string | null } {
  const xff = headers.get("x-forwarded-for");
  const ip = xff ? xff.split(",")[0]!.trim() : headers.get("x-real-ip");
  return { ip: ip || null, userAgent: headers.get("user-agent") };
}
