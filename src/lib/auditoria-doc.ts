import crypto from "crypto";
import type { AccionAuditoriaDoc } from "@prisma/client";
import { db } from "@/lib/db";

export type DatosEslabon = {
  entidad: string;
  entidadId: string;
  accion: AccionAuditoriaDoc;
  usuarioId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  detalle?: string | null;
};

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

const LOCK_CADENA = 918273645;

export async function registrarAuditoriaDoc(datos: DatosEslabon): Promise<void> {
  await db.$transaction(
    async (tx) => {
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
    },
    { maxWait: 10_000, timeout: 15_000 }
  );
}

export async function verificarCadena(): Promise<{ ok: boolean; totalRevisadas: number; secuenciaRota?: number }> {
  const filas = await db.auditoriaDoc.findMany({
    orderBy: { secuencia: "asc" },
    select: { secuencia: true, entidad: true, entidadId: true, accion: true, usuarioId: true, ip: true, detalle: true, createdAt: true, hashAnterior: true, hash: true },
  });
  return verificarCadenaFilas(filas);
}

export function datosPeticion(headers: Headers): { ip: string | null; userAgent: string | null } {
  const xff = headers.get("x-forwarded-for");
  const ip = xff ? xff.split(",")[0]!.trim() : headers.get("x-real-ip");
  return { ip: ip || null, userAgent: headers.get("user-agent") };
}

export async function registrarAccesoDenegadoSeccion(
  seccion: string,
  session: { userId: string; nombre: string },
  headers: Headers
): Promise<void> {
  const { ip, userAgent } = datosPeticion(headers);
  await registrarAuditoriaDoc({
    entidad: "Acceso",
    entidadId: seccion,
    accion: "ACCESO_DENEGADO",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `${session.nombre} intentó entrar a "${seccion}" sin permiso de administrar el archivo`,
  }).catch((err) => console.error(`No se pudo registrar en la bitácora el acceso denegado a "${seccion}":`, err));
}

export async function registrarAccesoDenegadoAccion(
  operacion: string,
  entidadId: string,
  session: { userId: string; nombre: string },
  headers: Headers
): Promise<void> {
  const { ip, userAgent } = datosPeticion(headers);
  await registrarAuditoriaDoc({
    entidad: "Acceso",
    entidadId,
    accion: "ACCESO_DENEGADO",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `${session.nombre} intentó "${operacion}" sin el permiso necesario`,
  }).catch((err) => console.error(`No se pudo registrar en la bitácora el intento de "${operacion}":`, err));
}

export async function registrarErrorEjecucion(
  entidad: string,
  entidadId: string,
  operacion: string,
  usuarioId: string | null,
  headers: Headers,
  error: unknown
): Promise<void> {
  const { ip, userAgent } = datosPeticion(headers);
  const mensaje = error instanceof Error ? error.message : String(error);
  await registrarAuditoriaDoc({
    entidad,
    entidadId,
    accion: "ERROR_EJECUCION",
    usuarioId,
    ip,
    userAgent,
    detalle: `Falló "${operacion}": ${mensaje}`.slice(0, 500),
  }).catch((err) => console.error(`No se pudo registrar en la bitácora el error de ejecución de "${operacion}":`, err));
}
