import type { NivelAccesoInformacion, OrigenExpedienteDocumental } from "@prisma/client";
import { db } from "@/lib/db";

export const ETIQUETA_ORIGEN_EXPEDIENTE: Record<OrigenExpedienteDocumental, string> = {
  SGDEA: "SGDEA",
  TRAMITES: "Trámites ambientales 2.0",
  GECON: "GECON — Contratación",
};

export const ETIQUETA_CORTA_ORIGEN: Record<OrigenExpedienteDocumental, string> = {
  SGDEA: "SGDEA",
  TRAMITES: "Trámites 2.0",
  GECON: "GECON",
};

export const CLASE_ORIGEN_EXPEDIENTE: Record<OrigenExpedienteDocumental, string> = {
  SGDEA: "bg-stone-100 text-stone-600",
  TRAMITES: "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200",
  GECON: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200",
};

export const MENSAJE_EXPEDIENTE_CERRADO =
  "El expediente está cerrado y archivado: para modificarlo, un usuario autorizado debe reabrirlo desde Administración.";

export function mensajeSoloEnModulo(origen: OrigenExpedienteDocumental): string {
  return `Este expediente proviene de ${ETIQUETA_ORIGEN_EXPEDIENTE[origen]}: en el SGDEA solo se consulta y cualquier cambio se hace desde ese módulo.`;
}

export function enlaceOrigen(origen: OrigenExpedienteDocumental, origenId: string | null): string | null {
  if (!origenId) return null;
  if (origen === "TRAMITES") return `/expedientes/${origenId}`;
  if (origen === "GECON") return `/contratacion/expedientes/${origenId}`;
  return null;
}

export async function fichaArchivoDe(origenId: string) {
  return db.expedienteDocumental.findUnique({ where: { origenId }, select: { id: true, numero: true, estado: true } });
}

export async function tramiteCerrado(expedienteId: string): Promise<boolean> {
  const e = await db.expediente.findUnique({ where: { id: expedienteId }, select: { archivado: true } });
  return Boolean(e?.archivado);
}

export async function tramiteCerradoPorDocumento(documentoId: string): Promise<boolean> {
  const d = await db.expedienteDocumento.findUnique({ where: { id: documentoId }, select: { expediente: { select: { archivado: true } } } });
  return Boolean(d?.expediente.archivado);
}

export async function contratoCerrado(expedienteId: string): Promise<boolean> {
  const e = await db.expedienteContractual.findUnique({ where: { id: expedienteId }, select: { cerrado: true } });
  return Boolean(e?.cerrado);
}

export async function contratoCerradoPorDocumento(documentoId: string): Promise<boolean> {
  const d = await db.documentoContrato.findUnique({ where: { id: documentoId }, select: { expediente: { select: { cerrado: true } } } });
  return Boolean(d?.expediente.cerrado);
}

export async function firmasPendientesTramite(expedienteId: string): Promise<number> {
  return db.solicitudFirma.count({
    where: { estado: "PENDIENTE", rol: { not: "LECTURA" }, documentoExpediente: { expedienteId } },
  });
}

export async function firmasPendientesContrato(expedienteId: string): Promise<number> {
  return db.solicitudFirma.count({
    where: { estado: "PENDIENTE", rol: { not: "LECTURA" }, documentoContrato: { expedienteId } },
  });
}

export async function firmasPendientesArchivo(expedienteDocumentalId: string): Promise<number> {
  return db.solicitudFirma.count({
    where: { estado: "PENDIENTE", rol: { not: "LECTURA" }, documentoArchivo: { expedienteDocumentalId, retiradoEn: null } },
  });
}

export function mensajeFirmasPendientes(n: number): string {
  return `No se puede cerrar: hay ${n} firma${n === 1 ? "" : "s"} o visto${n === 1 ? "" : "s"} bueno${n === 1 ? "" : "s"} pendiente${n === 1 ? "" : "s"}. Deben completarse o rechazarse antes del cierre.`;
}

export function validarFundamentoNivelAcceso(nivel: NivelAccesoInformacion, fundamento: string) {
  if (nivel !== "PUBLICA" && !fundamento.trim()) {
    throw new Error("Clasificar o reservar información exige indicar el fundamento legal (Ley 1712/2014, arts. 18-19).");
  }
}

export function esNivelAccesoValido(v: unknown): v is NivelAccesoInformacion {
  return v === "PUBLICA" || v === "CLASIFICADA" || v === "RESERVADA";
}

function recortar(texto: string, max: number): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio;
}

type FichaArchivo = {
  origen: OrigenExpedienteDocumental;
  origenId: string;
  archivado: boolean;
  numero: string;
  asunto: string;
  dependenciaId: string | null;
  serieId: string | null;
  subserieId: string | null;
  creadoPorId: string;
  fechaApertura: Date;
  fechaCierre: Date | null;
  cerradoPorId: string | null;
  nivelAcceso: NivelAccesoInformacion;
  fundamentoNivelAcceso: string | null;
  documentos: number;
};

async function publicarFicha(f: FichaArchivo) {
  const existente = await db.expedienteDocumental.findUnique({ where: { origenId: f.origenId }, select: { id: true } });
  if (!f.archivado) {
    if (existente) {
      await db.expedienteDocumental.update({
        where: { id: existente.id },
        data: {
          estado: "ABIERTO",
          fechaCierre: null,
          cerradoPorId: null,
          asunto: f.asunto,
          nivelAcceso: f.nivelAcceso,
          fundamentoNivelAcceso: f.fundamentoNivelAcceso,
          origenDocumentos: f.documentos,
          ...(f.dependenciaId && f.subserieId ? { dependenciaId: f.dependenciaId, serieId: f.serieId, subserieId: f.subserieId } : {}),
        },
      });
    }
    return;
  }
  if (!f.dependenciaId || !f.subserieId) {
    throw new Error("Para cerrar el expediente debe tener clasificación TRD (dependencia, serie y subserie).");
  }
  const datos = {
    numero: f.numero,
    asunto: f.asunto,
    estado: "CERRADO" as const,
    dependenciaId: f.dependenciaId,
    serieId: f.serieId,
    subserieId: f.subserieId,
    creadoPorId: f.creadoPorId,
    fechaApertura: f.fechaApertura,
    fechaCierre: f.fechaCierre ?? new Date(),
    cerradoPorId: f.cerradoPorId,
    nivelAcceso: f.nivelAcceso,
    fundamentoNivelAcceso: f.fundamentoNivelAcceso,
    origen: f.origen,
    origenId: f.origenId,
    origenDocumentos: f.documentos,
  };
  await db.expedienteDocumental.upsert({ where: { origenId: f.origenId }, create: datos, update: datos });
}

export async function sincronizarArchivoTramite(expedienteId: string) {
  const e = await db.expediente.findUnique({
    where: { id: expedienteId },
    select: {
      numero: true,
      solicitanteNombre: true,
      createdById: true,
      fechaRadicacion: true,
      archivado: true,
      archivadoEn: true,
      archivadoPorId: true,
      nivelAcceso: true,
      fundamentoNivelAcceso: true,
      tramiteTipo: { select: { nombre: true } },
      subserie: { select: { id: true, serieId: true, serie: { select: { dependenciaId: true } } } },
      _count: { select: { documentos: true } },
    },
  });
  if (!e) return;
  await publicarFicha({
    origen: "TRAMITES",
    origenId: expedienteId,
    archivado: e.archivado,
    numero: e.numero,
    asunto: recortar(`${e.tramiteTipo.nombre} — ${e.solicitanteNombre}`, 500),
    dependenciaId: e.subserie?.serie.dependenciaId ?? null,
    serieId: e.subserie?.serieId ?? null,
    subserieId: e.subserie?.id ?? null,
    creadoPorId: e.createdById,
    fechaApertura: e.fechaRadicacion,
    fechaCierre: e.archivadoEn,
    cerradoPorId: e.archivadoPorId,
    nivelAcceso: e.nivelAcceso,
    fundamentoNivelAcceso: e.fundamentoNivelAcceso,
    documentos: e._count.documentos,
  });
}

export async function sincronizarArchivoContrato(expedienteId: string) {
  const c = await db.expedienteContractual.findUnique({
    where: { id: expedienteId },
    select: {
      numero: true,
      objeto: true,
      numeroContrato: true,
      cerrado: true,
      fechaCierre: true,
      eliminado: true,
      createdAt: true,
      creadoPorId: true,
      nivelAcceso: true,
      fundamentoNivelAcceso: true,
      subserie: { select: { id: true, serieId: true, serie: { select: { dependenciaId: true } } } },
      _count: { select: { documentos: true } },
      eventos: { where: { tipo: "EXPEDIENTE_CERRADO" }, orderBy: { createdAt: "desc" }, take: 1, select: { usuarioId: true } },
    },
  });
  if (!c) return;
  if (c.eliminado) {
    await db.expedienteDocumental.deleteMany({ where: { origenId: expedienteId, origen: "GECON" } });
    return;
  }
  await publicarFicha({
    origen: "GECON",
    origenId: expedienteId,
    archivado: c.cerrado,
    numero: c.numero,
    asunto: recortar(`${c.numeroContrato ? `Contrato ${c.numeroContrato} — ` : ""}${c.objeto}`, 500),
    dependenciaId: c.subserie?.serie.dependenciaId ?? null,
    serieId: c.subserie?.serieId ?? null,
    subserieId: c.subserie?.id ?? null,
    creadoPorId: c.creadoPorId,
    fechaApertura: c.createdAt,
    fechaCierre: c.fechaCierre,
    cerradoPorId: c.eventos[0]?.usuarioId ?? null,
    nivelAcceso: c.nivelAcceso,
    fundamentoNivelAcceso: c.fundamentoNivelAcceso,
    documentos: c._count.documentos,
  });
}
