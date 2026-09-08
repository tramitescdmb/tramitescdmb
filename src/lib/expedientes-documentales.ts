import crypto from "crypto";
import { db } from "@/lib/db";
import { generarConsecutivo, formatearRadicado } from "@/lib/radicado";
import { parsePorPagina } from "@/lib/vista-lista";
import type { PermisosUsuario } from "@/lib/permisos";
import type { EstadoExpedienteDocumental, NivelAccesoInformacion, Prisma } from "@prisma/client";

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
  fechaDocumento?: Date | null;
  tipoDocumentalId?: string | null;
}) {
  const expediente = await db.expedienteDocumental.findUnique({
    where: { id: datos.expedienteDocumentalId },
    select: { estado: true, subserieId: true },
  });
  if (!expediente) throw new Error("El expediente no existe.");
  if (expediente.estado === "CERRADO") throw new Error("Este expediente está cerrado: no se pueden agregar más documentos.");

  // El tipo documental solo puede ser uno de los definidos en la TRD para la subserie de ESTE expediente —
  // evita que quede guardado un tipo de otra subserie sin sentido para este expediente.
  if (datos.tipoDocumentalId) {
    const tipo = await db.tipoDocumental.findUnique({ where: { id: datos.tipoDocumentalId }, select: { subserieId: true } });
    if (!tipo || tipo.subserieId !== expediente.subserieId) {
      throw new Error("El tipo documental elegido no corresponde a la subserie de este expediente.");
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

/** Renombra un expediente (asunto/descripción) — no toca el índice ni su hash, que solo depende de los
 * documentos (ver calcularHashIndice), así que no invalida nada si el expediente ya está cerrado. Aun
 * así se restringe a mientras esté ABIERTO: un cerrado se trata como definitivo en todo lo demás. */
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

/** Igual que cambiarNivelAccesoComunicacion pero para el expediente documental completo (Ley 1712/2014). */
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

/** Presta el expediente a un funcionario — solo registra quién lo tiene y desde cuándo, no bloquea nada
 * (subir/editar/cerrar siguen gobernados solo por dependencia/rol). No deja prestar de nuevo mientras haya
 * un préstamo vigente (sin fechaDevolucionReal): primero hay que devolverlo. */
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
  // Deliberadamente sin desplegable en la UI (con 237+ series era peor UX que no tenerlo, feedback
  // directo del usuario) — solo se llega por un enlace directo desde el explorador de la TRD (MoReq 4.3:
  // "expedientes de una serie").
  serieId?: string;
  page?: string;
  vista?: string;
};

/** Un expediente CLASIFICADA/RESERVADA (Ley 1712/2014) ni se lista ni se exporta para quien no puede
 * gestionarlo — de lo contrario el nivel de acceso sería solo una etiqueta visual y no un control real
 * (ver puedeVerNivelAccesoExpediente en permisos.ts, que aplica la misma regla al ver el detalle). */
function restringirPorNivelAcceso(permisos: PermisosUsuario): Prisma.ExpedienteDocumentalWhereInput {
  if (permisos.esAdmin || permisos.correspondencia === "ADMIN_ARCHIVO") return {};
  return { OR: [{ nivelAcceso: "PUBLICA" }, { dependenciaId: permisos.dependenciaId ?? "__sin_dependencia__" }] };
}

/** La búsqueda de texto cubre número, asunto y dependencia del expediente, Y TAMBIÉN el nombre de
 * cada archivo que tenga dentro — así "buscar un expediente" y "buscar un archivo perdido dentro de
 * algún expediente" son la misma caja de búsqueda, sin tener que abrir uno por uno para revisar. */
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
        _count: { select: { documentos: true, comunicaciones: true } },
        // Solo trae los documentos que coinciden con la búsqueda — para poder mostrar
        // "coincide: archivo.pdf" en el resultado sin cargar todo el índice del expediente.
        // Sin término de búsqueda, la condición no puede coincidir con nada (evita traer
        // documentos de más cuando no hace falta) sin cambiar la forma del include/resultado.
        documentos: { where: q ? { nombre: { contains: q, mode: "insensitive" } } : { id: "" }, select: { nombre: true }, take: 3 },
      },
    }),
  ]);

  return { filas, total, page, totalPaginas: Math.max(1, Math.ceil(total / porPagina)), porPagina, vista };
}
