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
  vencimiento?: string;
  despacho?: string;
  orden?: string;
  page?: string;
  vista?: string;
};

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

function camposBusqueda(texto: string): Prisma.ComunicacionWhereInput[] {
  return [
    { radicado: { contains: texto, mode: "insensitive" } },
    { asunto: { contains: texto, mode: "insensitive" } },
    { terceroNombre: { contains: texto, mode: "insensitive" } },
    { terceroIdentificacion: { contains: texto } },
    { documentos: { some: { nombre: { contains: texto, mode: "insensitive" } } } },
    { contenido: { contains: texto, mode: "insensitive" } },
    { respuestaTexto: { contains: texto, mode: "insensitive" } },
    { palabrasClave: { has: texto } },
  ];
}

function clausulaExcluirBusqueda(texto: string): Prisma.ComunicacionWhereInput {
  const noContiene = (contains: Prisma.ComunicacionWhereInput): Prisma.ComunicacionWhereInput => ({ NOT: contains });
  const noContieneOpcional = (
    campo: "terceroNombre" | "terceroIdentificacion" | "contenido" | "respuestaTexto",
    modo?: "insensitive"
  ): Prisma.ComunicacionWhereInput => ({
    OR: [{ [campo]: null }, { NOT: { [campo]: { contains: texto, ...(modo ? { mode: modo } : {}) } } }],
  });
  return {
    AND: [
      noContiene({ radicado: { contains: texto, mode: "insensitive" } }),
      noContiene({ asunto: { contains: texto, mode: "insensitive" } }),
      noContieneOpcional("terceroNombre", "insensitive"),
      noContieneOpcional("terceroIdentificacion"),
      noContieneOpcional("contenido", "insensitive"),
      noContieneOpcional("respuestaTexto", "insensitive"),
      { documentos: { none: { nombre: { contains: texto, mode: "insensitive" } } } },
      { NOT: { palabrasClave: { has: texto } } },
    ],
  };
}

export function parseConsultaBusqueda(q: string): { texto: string; excluir: boolean }[] {
  const terminos: { texto: string; excluir: boolean }[] = [];
  const re = /(-?)"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q)) !== null) {
    if (m[2] !== undefined) {
      const texto = m[2].trim();
      if (texto) terminos.push({ texto, excluir: m[1] === "-" });
    } else {
      let token = m[3]!;
      const excluir = token.startsWith("-");
      if (excluir) token = token.slice(1);
      for (const parte of token.split("*")) {
        const texto = parte.trim();
        if (texto) terminos.push({ texto, excluir });
      }
    }
  }
  return terminos;
}

export function construirWhereCorrespondencia(
  f: FiltrosCorrespondencia,
  rango: RangoPeriodo = null
): Prisma.ComunicacionWhereInput {
  const and: Prisma.ComunicacionWhereInput[] = [];
  if (esTipoValido(f.tipo)) and.push({ tipo: f.tipo });
  if (f.q?.trim()) {
    for (const { texto, excluir } of parseConsultaBusqueda(f.q)) {
      and.push(excluir ? clausulaExcluirBusqueda(texto) : { OR: camposBusqueda(texto) });
    }
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
  if (f.despacho === "sin_despachar") and.push({ tipo: "ENVIADA", estado: { not: "ANULADA" }, despachadaEn: null, firmas: { some: {} } });
  if (f.despacho === "despachadas") and.push({ despachadaEn: { not: null } });
  if (rango) and.push({ fechaRadicacion: { gte: rango.desde, lt: rango.hasta } });
  return and.length ? { AND: and } : {};
}

export async function contarComunicacionesVencidas(): Promise<number> {
  return db.comunicacion.count({
    where: { estado: { in: ESTADOS_ABIERTOS_TERMINO }, fechaVencimiento: { lt: new Date() } },
  });
}

export async function contarOficiosSinDespachar(): Promise<number> {
  return db.comunicacion.count({
    where: { tipo: "ENVIADA", estado: { not: "ANULADA" }, despachadaEn: null, firmas: { some: {} } },
  });
}

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
        respondeA: { select: { id: true, radicado: true } },
        respuestas: { select: { id: true, radicado: true, despachadaEn: true }, orderBy: { fechaRadicacion: "desc" }, take: 1 },
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
    db.serieDocumental.findMany({
      where: { activo: true, vigenteHasta: null },
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, nombre: true, dependencia: { select: { id: true, nombre: true } } },
    }),
  ]);
  return { dependencias, series, estados: ESTADOS_VALIDOS, tipos: TIPOS_VALIDOS };
}
