import crypto from "crypto";
import { db } from "@/lib/db";
import { generarConsecutivo, formatearRadicado } from "@/lib/radicado";
import type { EstadoExpedienteDocumental } from "@prisma/client";

/**
 * Expediente electrónico de archivo general (Art. 4.3.2 Acuerdo 001/2024 AGN):
 * la unidad documental de un trámite, actuación o procedimiento de UNA
 * dependencia — a diferencia de `Expediente` (trámites ambientales) y de
 * `Comunicacion` (un radicado puntual). Un funcionario abre uno y le sube
 * documentos directamente, sin que estos tengan que llegar por
 * correspondencia; también se le pueden archivar comunicaciones ya radicadas.
 */

const SERIE_EXPEDIENTE = "X";

export async function generarNumeroExpediente(anio: number = new Date().getFullYear()): Promise<string> {
  const { numero } = await generarConsecutivo(SERIE_EXPEDIENTE, anio);
  return formatearRadicado(SERIE_EXPEDIENTE, anio, numero);
}

export async function crearExpedienteDocumental(datos: {
  asunto: string;
  descripcion?: string | null;
  dependenciaId: string;
  serieId?: string | null;
  subserieId?: string | null;
  creadoPorId: string;
}) {
  if (!datos.asunto.trim()) throw new Error("El asunto del expediente es obligatorio.");
  const numero = await generarNumeroExpediente();
  return db.expedienteDocumental.create({
    data: {
      numero,
      asunto: datos.asunto.trim(),
      descripcion: datos.descripcion?.trim() || null,
      dependenciaId: datos.dependenciaId,
      serieId: datos.serieId || null,
      subserieId: datos.subserieId || null,
      creadoPorId: datos.creadoPorId,
    },
  });
}

export async function agregarDocumentoArchivo(datos: {
  expedienteDocumentalId: string;
  nombre: string;
  descripcion?: string | null;
  storagePath: string;
  mimeType: string;
  tamanoBytes: number;
  hashSha256?: string | null;
  subidoPorId: string;
}) {
  const expediente = await db.expedienteDocumental.findUnique({
    where: { id: datos.expedienteDocumentalId },
    select: { estado: true },
  });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.estado === "CERRADO") throw new Error("Este expediente está cerrado: no se pueden agregar más documentos.");

  const ultimo = await db.documentoArchivo.findFirst({
    where: { expedienteDocumentalId: datos.expedienteDocumentalId },
    orderBy: { ordenIndice: "desc" },
    select: { ordenIndice: true },
  });
  return db.documentoArchivo.create({
    data: {
      expedienteDocumentalId: datos.expedienteDocumentalId,
      nombre: datos.nombre,
      descripcion: datos.descripcion?.trim() || null,
      storagePath: datos.storagePath,
      mimeType: datos.mimeType,
      tamanoBytes: datos.tamanoBytes,
      hashSha256: datos.hashSha256 || null,
      subidoPorId: datos.subidoPorId,
      ordenIndice: (ultimo?.ordenIndice ?? 0) + 1,
    },
  });
}

/**
 * Hash del índice electrónico (Art. 4.3.2.2-4 AGN: "firma del índice
 * electrónico" al cerrar el expediente). Resume el orden y la huella de cada
 * documento — si algo cambiara después de cerrado, el hash recalculado ya no
 * coincidiría con el guardado.
 */
export function calcularHashIndice(documentos: { ordenIndice: number; nombre: string; hashSha256: string | null }[]): string {
  const base = documentos
    .slice()
    .sort((a, b) => a.ordenIndice - b.ordenIndice)
    .map((d) => `${d.ordenIndice}|${d.nombre}|${d.hashSha256 ?? ""}`)
    .join("\n");
  return crypto.createHash("sha256").update(base).digest("hex");
}

export async function cerrarExpedienteDocumental(expedienteId: string, usuarioId: string) {
  const expediente = await db.expedienteDocumental.findUnique({
    where: { id: expedienteId },
    include: { documentos: { select: { ordenIndice: true, nombre: true, hashSha256: true } } },
  });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.estado === "CERRADO") throw new Error("Este expediente ya está cerrado.");
  if (expediente.documentos.length === 0) throw new Error("No se puede cerrar un expediente sin documentos.");

  const indiceHash = calcularHashIndice(expediente.documentos);
  return db.expedienteDocumental.update({
    where: { id: expedienteId },
    data: { estado: "CERRADO", fechaCierre: new Date(), cerradoPorId: usuarioId, indiceHash },
  });
}

export async function archivarComunicacionEnExpedienteDocumental(comunicacionId: string, expedienteId: string) {
  const expediente = await db.expedienteDocumental.findUnique({ where: { id: expedienteId }, select: { estado: true } });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.estado === "CERRADO") throw new Error("Este expediente está cerrado: no se le pueden archivar más comunicaciones.");
  return db.comunicacion.update({ where: { id: comunicacionId }, data: { expedienteDocumentalId: expedienteId } });
}

export async function listarExpedientesDocumentales(filtro?: { dependenciaId?: string; estado?: EstadoExpedienteDocumental }) {
  return db.expedienteDocumental.findMany({
    where: {
      dependenciaId: filtro?.dependenciaId,
      estado: filtro?.estado,
    },
    orderBy: { createdAt: "desc" },
    include: {
      dependencia: { select: { nombre: true } },
      serie: { select: { codigo: true, nombre: true } },
      subserie: { select: { codigo: true, nombre: true } },
      creadoPor: { select: { nombre: true } },
      _count: { select: { documentos: true, comunicaciones: true } },
    },
  });
}
