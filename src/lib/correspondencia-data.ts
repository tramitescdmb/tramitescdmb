import { Prisma, type EstadoComunicacion, type TipoComunicacion } from "@prisma/client";
import { db } from "@/lib/db";
import { parsePorPagina } from "@/lib/vista-lista";
import type { RangoPeriodo } from "@/lib/periodo-dashboard";

export type FiltrosCorrespondencia = {
  q?: string;
  tipo?: string;
  estado?: string;
  dependencia?: string;
  serieId?: string;
  vencimiento?: string; // "vencidas" | "por_vencer" (MoReq 7.19)
  orden?: string;
  page?: string;
  vista?: string;
};

/** Estados en los que una comunicación con término de ley todavía "corre" (no cerrada). */
const ESTADOS_ABIERTOS_TERMINO: EstadoComunicacion[] = [
  "RADICADA",
  "EN_REPARTO",
  "ASIGNADA",
  "EN_TRAMITE",
  "INFORMACION_ADICIONAL_REQUERIDA",
];

const ORDEN_VALIDO = ["fecha_desc", "fecha_asc", "asunto_asc", "tercero_asc"] as const;
export type OrdenCorrespondencia = (typeof ORDEN_VALIDO)[number];
export const ETIQUETA_ORDEN: Record<OrdenCorrespondencia, string> = {
  fecha_desc: "Más reciente primero",
  fecha_asc: "Más antiguo primero",
  asunto_asc: "Asunto (A-Z)",
  tercero_asc: "Remitente/destinatario (A-Z)",
};
function esOrdenValido(v: string | undefined): v is OrdenCorrespondencia {
  return !!v && (ORDEN_VALIDO as readonly string[]).includes(v);
}
const ORDER_BY: Record<OrdenCorrespondencia, Prisma.ComunicacionOrderByWithRelationInput[]> = {
  fecha_desc: [{ fechaRadicacion: "desc" }, { radicado: "desc" }],
  fecha_asc: [{ fechaRadicacion: "asc" }, { radicado: "asc" }],
  asunto_asc: [{ asunto: "asc" }],
  tercero_asc: [{ terceroNombre: { sort: "asc", nulls: "last" } }],
};

const ESTADOS_VALIDOS: EstadoComunicacion[] = [
  "RADICADA",
  "EN_REPARTO",
  "ASIGNADA",
  "EN_TRAMITE",
  "INFORMACION_ADICIONAL_REQUERIDA",
  "RESPONDIDA",
  "ARCHIVADA",
  "ANULADA",
];

const TIPOS_VALIDOS: TipoComunicacion[] = ["RECIBIDA", "ENVIADA", "INTERNA"];

export function esEstadoValido(v: string | undefined): v is EstadoComunicacion {
  return !!v && (ESTADOS_VALIDOS as string[]).includes(v);
}

export function esTipoValido(v: string | undefined): v is TipoComunicacion {
  return !!v && (TIPOS_VALIDOS as string[]).includes(v);
}

/** `rango`: mismo período seleccionable de los dashboards, acotando por `fechaRadicacion`. Sin
 * filtro de tipo, la bandeja muestra las tres clases de comunicación (recibida/enviada/interna). */
export function construirWhereCorrespondencia(
  f: FiltrosCorrespondencia,
  rango: RangoPeriodo = null
): Prisma.ComunicacionWhereInput {
  const and: Prisma.ComunicacionWhereInput[] = [];
  if (esTipoValido(f.tipo)) and.push({ tipo: f.tipo });
  if (f.q?.trim()) {
    const q = f.q.trim();
    and.push({
      OR: [
        { radicado: { contains: q, mode: "insensitive" } },
        { asunto: { contains: q, mode: "insensitive" } },
        { terceroNombre: { contains: q, mode: "insensitive" } },
        { terceroIdentificacion: { contains: q } },
        // También encuentra por el nombre de un documento adjunto — un memorando o un oficio
        // se suele recordar por el archivo que se subió, no por su radicado o asunto exacto.
        { documentos: { some: { nombre: { contains: q, mode: "insensitive" } } } },
        // Y por el CONTENIDO real (MoReq 4.11: búsqueda de texto libre integrada, no solo metadatos) — el
        // cuerpo firmado de una enviada/memorando, y el borrador de respuesta de una recibida.
        { contenido: { contains: q, mode: "insensitive" } },
        { respuestaTexto: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (esEstadoValido(f.estado)) and.push({ estado: f.estado });
  if (f.dependencia) and.push({ OR: [{ dependenciaDestinoId: f.dependencia }, { dependenciaOrigenId: f.dependencia }] });
  if (f.serieId) and.push({ serieId: f.serieId });
  if (f.vencimiento === "vencidas" || f.vencimiento === "por_vencer") {
    const ahora = new Date();
    const limite =
      f.vencimiento === "vencidas"
        ? { lt: ahora }
        : { gte: ahora, lt: new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000) };
    and.push({ estado: { in: ESTADOS_ABIERTOS_TERMINO }, fechaVencimiento: limite });
  }
  if (rango) and.push({ fechaRadicacion: { gte: rango.desde, lt: rango.hasta } });
  return and.length ? { AND: and } : {};
}

/**
 * Cuenta de comunicaciones con el término de ley vencido y aún sin cerrar
 * (MoReq 7.19: notificación de incumplimiento — sin correo, es un aviso visible
 * en la bandeja para quien tramita).
 */
export async function contarComunicacionesVencidas(): Promise<number> {
  return db.comunicacion.count({
    where: { estado: { in: ESTADOS_ABIERTOS_TERMINO }, fechaVencimiento: { lt: new Date() } },
  });
}

/**
 * Comunicaciones sin clasificación TRD completa (sin serie o sin subserie),
 * excluidas las anuladas (MoReq 1.34: garantizar que todo documento quede
 * asociado a una TRD — el aviso hace visible lo que falta reclasificar).
 */
export async function getComunicacionesSinClasificar(limite = 100) {
  const where = { estado: { not: "ANULADA" as EstadoComunicacion }, OR: [{ serieId: null }, { subserieId: null }] };
  const [total, filas] = await Promise.all([
    db.comunicacion.count({ where }),
    db.comunicacion.findMany({
      where,
      orderBy: { fechaRadicacion: "desc" },
      take: limite,
      select: { id: true, radicado: true, asunto: true, fechaRadicacion: true },
    }),
  ]);
  return { total, filas };
}

export async function getCorrespondenciaListado(filtros: FiltrosCorrespondencia, rango: RangoPeriodo = null) {
  const page = Math.max(1, parseInt(filtros.page ?? "1", 10) || 1);
  const { porPagina, vista } = parsePorPagina(filtros.vista);
  const where = construirWhereCorrespondencia(filtros, rango);
  const q = filtros.q?.trim();

  const orden = esOrdenValido(filtros.orden) ? filtros.orden : "fecha_desc";

  const [total, filas] = await Promise.all([
    db.comunicacion.count({ where }),
    db.comunicacion.findMany({
      where,
      orderBy: ORDER_BY[orden],
      skip: (page - 1) * porPagina,
      take: porPagina,
      include: {
        dependenciaDestino: { select: { nombre: true } },
        dependenciaOrigen: { select: { nombre: true } },
        _count: { select: { documentos: true } },
        // Solo trae los documentos que coinciden con la búsqueda, para mostrar "Coincide: archivo.pdf"
        // en el resultado. Sin término de búsqueda, `id` nunca es "" así que no trae ninguno — mismo
        // patrón que listarExpedientesDocumentales, para no alternar la forma del include/resultado.
        documentos: { where: q ? { nombre: { contains: q, mode: "insensitive" } } : { id: "" }, select: { nombre: true }, take: 3 },
      },
    }),
  ]);

  return { filas, total, page, totalPaginas: Math.max(1, Math.ceil(total / porPagina)), porPagina, vista, orden };
}

export async function getCorrespondenciaOpcionesFiltro() {
  const [dependencias, series] = await Promise.all([
    db.dependencia.findMany({
      where: { activo: true },
      orderBy: [{ nivel: "asc" }, { orden: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true },
    }),
    // Vigentes de cualquier dependencia — el filtro de serie es independiente del de dependencia
    // (se puede filtrar por serie sin haber elegido antes una dependencia).
    db.serieDocumental.findMany({
      where: { activo: true, vigenteHasta: null },
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, nombre: true, dependencia: { select: { id: true, nombre: true } } },
    }),
  ]);
  return { dependencias, series, estados: ESTADOS_VALIDOS, tipos: TIPOS_VALIDOS };
}
