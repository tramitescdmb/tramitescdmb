import crypto from "crypto";
import { db } from "@/lib/db";
import { generarConsecutivo, formatearRadicado } from "@/lib/radicado";
import { parsePorPagina } from "@/lib/vista-lista";
import type { PermisosUsuario } from "@/lib/permisos";
import type { CriterioOrdenExpediente, NivelAccesoInformacion, Prisma } from "@prisma/client";

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
  fechaDocumento?: Date | null;
  tipoDocumentalId?: string | null;
  reemplazaId?: string | null;
  numeroFolios?: number | null;
}) {
  const expediente = await db.expedienteDocumental.findUnique({
    where: { id: datos.expedienteDocumentalId },
    select: { estado: true, subserieId: true },
  });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.estado === "CERRADO") throw new Error("Este expediente está cerrado: no se pueden agregar más documentos.");

  if (datos.tipoDocumentalId) {
    const tipo = await db.tipoDocumental.findUnique({ where: { id: datos.tipoDocumentalId }, select: { subserieId: true } });
    if (!tipo || tipo.subserieId !== expediente.subserieId) {
      throw new Error("El tipo documental elegido no corresponde a la subserie de este expediente.");
    }
  }

  if (datos.reemplazaId) {
    const anterior = await db.documentoArchivo.findUnique({ where: { id: datos.reemplazaId }, select: { expedienteDocumentalId: true } });
    if (!anterior || anterior.expedienteDocumentalId !== datos.expedienteDocumentalId) {
      throw new Error("El documento que se quiere reemplazar no pertenece a este expediente.");
    }
  }

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
      fechaDocumento: datos.fechaDocumento ?? null,
      tipoDocumentalId: datos.tipoDocumentalId || null,
      reemplazaId: datos.reemplazaId || null,
      numeroFolios: datos.numeroFolios && datos.numeroFolios > 0 ? Math.floor(datos.numeroFolios) : 1,
      ordenIndice: (ultimo?.ordenIndice ?? 0) + 1,
    },
  });
}

export async function editarDocumentoArchivo(
  documentoId: string,
  datos: { nombre?: string; tipoDocumentalId?: string | null; numeroFolios?: number | null; fechaDocumento?: Date | null }
) {
  const doc = await db.documentoArchivo.findUnique({
    where: { id: documentoId },
    select: { id: true, retiradoEn: true, expediente: { select: { estado: true, subserieId: true } } },
  });
  if (!doc) throw new Error("El documento no existe.");
  if (doc.retiradoEn) throw new Error("Este documento está retirado del índice.");
  if (doc.expediente.estado === "CERRADO") throw new Error("El expediente está cerrado: no se puede editar el documento.");

  if (datos.tipoDocumentalId) {
    const tipo = await db.tipoDocumental.findUnique({ where: { id: datos.tipoDocumentalId }, select: { subserieId: true } });
    if (!tipo || tipo.subserieId !== doc.expediente.subserieId) {
      throw new Error("El tipo documental elegido no corresponde a la subserie de este expediente.");
    }
  }

  const nombre = datos.nombre?.trim();
  return db.documentoArchivo.update({
    where: { id: documentoId },
    data: {
      ...(nombre ? { nombre } : {}),
      ...(datos.tipoDocumentalId !== undefined ? { tipoDocumentalId: datos.tipoDocumentalId || null } : {}),
      ...(datos.numeroFolios && datos.numeroFolios > 0 ? { numeroFolios: Math.floor(datos.numeroFolios) } : {}),
      ...(datos.fechaDocumento !== undefined ? { fechaDocumento: datos.fechaDocumento } : {}),
    },
  });
}

export async function retirarDocumentoArchivo(documentoId: string, usuarioId: string, motivo: string) {
  if (!motivo.trim()) throw new Error("Indique por qué se retira este archivo del índice.");
  const doc = await db.documentoArchivo.findUnique({
    where: { id: documentoId },
    select: { id: true, nombre: true, retiradoEn: true, expediente: { select: { estado: true } } },
  });
  if (!doc) throw new Error("El documento no existe.");
  if (doc.retiradoEn) throw new Error("Este documento ya está retirado del índice.");
  if (doc.expediente.estado === "CERRADO") throw new Error("El expediente está cerrado: el índice ya está firmado y no admite cambios.");

  await db.documentoArchivo.update({
    where: { id: documentoId },
    data: { retiradoEn: new Date(), retiradoPorId: usuarioId, motivoRetiro: motivo.trim() },
  });
  return { nombre: doc.nombre };
}

export const ETIQUETA_CRITERIO_ORDEN: Record<CriterioOrdenExpediente, string> = {
  FECHA_DOCUMENTO: "Fecha del documento (por defecto)",
  FECHA_INCORPORACION: "Orden de incorporación al índice",
  NOMBRE: "Nombre del archivo (alfabético)",
};

export const CRITERIOS_ORDEN: CriterioOrdenExpediente[] = ["FECHA_DOCUMENTO", "FECHA_INCORPORACION", "NOMBRE"];

export function esCriterioOrdenValido(v: string | undefined | null): v is CriterioOrdenExpediente {
  return !!v && (CRITERIOS_ORDEN as string[]).includes(v);
}

type DocOrdenable = { ordenIndice: number; nombre: string; fechaDocumento: Date | null; createdAt: Date };

export function ordenarDocumentosExpediente<T extends DocOrdenable>(documentos: T[], criterio: CriterioOrdenExpediente): T[] {
  const copia = documentos.slice();
  switch (criterio) {
    case "FECHA_INCORPORACION":
      return copia.sort((a, b) => a.ordenIndice - b.ordenIndice);
    case "NOMBRE":
      return copia.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
    case "FECHA_DOCUMENTO":
    default:
      return copia.sort((a, b) => (a.fechaDocumento ?? a.createdAt).getTime() - (b.fechaDocumento ?? b.createdAt).getTime());
  }
}

export function calcularHashIndice(
  documentos: { ordenIndice: number; nombre: string; hashSha256: string | null; retiradoEn?: Date | null }[]
): string {
  const base = documentos
    .filter((d) => !d.retiradoEn)
    .slice()
    .sort((a, b) => a.ordenIndice - b.ordenIndice)
    .map((d) => `${d.ordenIndice}|${d.nombre}|${d.hashSha256 ?? ""}`)
    .join("\n");
  return crypto.createHash("sha256").update(base).digest("hex");
}

export async function editarExpedienteDocumental(expedienteId: string, datos: { asunto: string; descripcion?: string | null }) {
  if (!datos.asunto.trim()) throw new Error("El asunto del expediente es obligatorio.");
  const expediente = await db.expedienteDocumental.findUnique({ where: { id: expedienteId }, select: { estado: true } });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.estado === "CERRADO") throw new Error("Este expediente está cerrado: no se puede editar.");

  return db.expedienteDocumental.update({
    where: { id: expedienteId },
    data: { asunto: datos.asunto.trim(), descripcion: datos.descripcion?.trim() || null },
  });
}

export async function cerrarExpedienteDocumental(expedienteId: string, usuarioId: string) {
  const expediente = await db.expedienteDocumental.findUnique({
    where: { id: expedienteId },
    include: { documentos: { select: { ordenIndice: true, nombre: true, hashSha256: true, retiradoEn: true } } },
  });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.estado === "CERRADO") throw new Error("Este expediente ya está cerrado.");
  if (expediente.documentos.filter((d) => !d.retiradoEn).length === 0) {
    throw new Error("No se puede cerrar un expediente sin documentos en el índice.");
  }

  const indiceHash = calcularHashIndice(expediente.documentos);
  return db.expedienteDocumental.update({
    where: { id: expedienteId },
    data: { estado: "CERRADO", fechaCierre: new Date(), cerradoPorId: usuarioId, indiceHash },
  });
}

export async function reabrirExpedienteDocumental(expedienteId: string, motivo: string) {
  if (!motivo.trim()) throw new Error("Reabrir un expediente cerrado exige indicar el motivo.");
  const expediente = await db.expedienteDocumental.findUnique({ where: { id: expedienteId }, select: { estado: true } });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.estado !== "CERRADO") throw new Error("Este expediente no está cerrado.");

  return db.expedienteDocumental.update({
    where: { id: expedienteId },
    data: { estado: "ABIERTO", fechaCierre: null, cerradoPorId: null, indiceHash: null },
  });
}

export async function cambiarNivelAccesoExpediente(expedienteId: string, nivelAcceso: NivelAccesoInformacion, fundamento: string) {
  const expediente = await db.expedienteDocumental.findUnique({ where: { id: expedienteId }, select: { id: true, nivelAcceso: true } });
  if (!expediente) throw new Error("El expediente no existe.");
  if (nivelAcceso !== "PUBLICA" && !fundamento.trim()) {
    throw new Error("Clasificar o reservar información exige indicar el fundamento legal (Ley 1712/2014, arts. 18-19).");
  }

  await db.expedienteDocumental.update({
    where: { id: expedienteId },
    data: { nivelAcceso, fundamentoNivelAcceso: nivelAcceso === "PUBLICA" ? null : fundamento.trim() },
  });
  return { anterior: expediente.nivelAcceso, nuevo: nivelAcceso };
}

export async function prestarExpediente(datos: {
  expedienteId: string;
  prestadoAId: string;
  prestadoPorId: string;
  motivo?: string | null;
  fechaDevolucionEsperada?: Date | null;
}) {
  const vigente = await db.prestamoExpediente.findFirst({
    where: { expedienteDocumentalId: datos.expedienteId, fechaDevolucionReal: null },
    select: { id: true, prestadoA: { select: { nombre: true } } },
  });
  if (vigente) throw new Error(`Ya está prestado a ${vigente.prestadoA.nombre} — regístrelo como devuelto antes de prestarlo de nuevo.`);

  return db.prestamoExpediente.create({
    data: {
      expedienteDocumentalId: datos.expedienteId,
      prestadoAId: datos.prestadoAId,
      prestadoPorId: datos.prestadoPorId,
      motivo: datos.motivo?.trim() || null,
      fechaDevolucionEsperada: datos.fechaDevolucionEsperada ?? null,
    },
  });
}

export async function devolverExpediente(prestamoId: string) {
  const prestamo = await db.prestamoExpediente.findUnique({ where: { id: prestamoId }, select: { fechaDevolucionReal: true } });
  if (!prestamo) throw new Error("El préstamo no existe.");
  if (prestamo.fechaDevolucionReal) throw new Error("Este préstamo ya estaba registrado como devuelto.");
  return db.prestamoExpediente.update({ where: { id: prestamoId }, data: { fechaDevolucionReal: new Date() } });
}

export async function archivarComunicacionEnExpedienteDocumental(comunicacionId: string, expedienteId: string) {
  const expediente = await db.expedienteDocumental.findUnique({ where: { id: expedienteId }, select: { estado: true } });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.estado === "CERRADO") throw new Error("Este expediente está cerrado: no se le pueden archivar más comunicaciones.");
  return db.comunicacion.update({ where: { id: comunicacionId }, data: { expedienteDocumentalId: expedienteId } });
}

export type FiltrosExpedienteDocumental = {
  q?: string;
  estado?: string;
  dependenciaId?: string;
  serieId?: string;
  page?: string;
  vista?: string;
};

function restringirPorNivelAcceso(permisos: PermisosUsuario): Prisma.ExpedienteDocumentalWhereInput {
  if (permisos.esAdmin || permisos.correspondencia === "ADMIN_ARCHIVO") return {};
  return { OR: [{ nivelAcceso: "PUBLICA" }, { dependenciaId: permisos.dependenciaId ?? "__sin_dependencia__" }] };
}

export function construirWhereExpedienteDocumental(
  f: FiltrosExpedienteDocumental,
  permisos: PermisosUsuario
): Prisma.ExpedienteDocumentalWhereInput {
  const and: Prisma.ExpedienteDocumentalWhereInput[] = [restringirPorNivelAcceso(permisos)];
  if (f.estado === "ABIERTO" || f.estado === "CERRADO") and.push({ estado: f.estado });
  if (f.dependenciaId) and.push({ dependenciaId: f.dependenciaId });
  if (f.serieId) and.push({ serieId: f.serieId });
  if (f.q?.trim()) {
    const q = f.q.trim();
    and.push({
      OR: [
        { numero: { contains: q, mode: "insensitive" } },
        { asunto: { contains: q, mode: "insensitive" } },
        { dependencia: { nombre: { contains: q, mode: "insensitive" } } },
        { documentos: { some: { nombre: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

export async function listarExpedientesDocumentales(filtro: FiltrosExpedienteDocumental | undefined, permisos: PermisosUsuario) {
  const page = Math.max(1, parseInt(filtro?.page ?? "1", 10) || 1);
  const { porPagina, vista } = parsePorPagina(filtro?.vista);
  const where = construirWhereExpedienteDocumental(filtro ?? {}, permisos);
  const q = filtro?.q?.trim();

  const [total, filas] = await Promise.all([
    db.expedienteDocumental.count({ where }),
    db.expedienteDocumental.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * porPagina,
      take: porPagina,
      include: {
        dependencia: { select: { nombre: true } },
        serie: { select: { codigo: true, nombre: true } },
        subserie: { select: { codigo: true, nombre: true } },
        creadoPor: { select: { nombre: true } },
        _count: { select: { documentos: { where: { retiradoEn: null } }, comunicaciones: true } },
        documentos: { where: q ? { nombre: { contains: q, mode: "insensitive" } } : { id: "" }, select: { nombre: true }, take: 3 },
      },
    }),
  ]);

  return { filas, total, page, totalPaginas: Math.max(1, Math.ceil(total / porPagina)), porPagina, vista };
}
