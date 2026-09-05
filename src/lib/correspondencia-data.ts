import { Prisma, type EstadoComunicacion, type TipoComunicacion } from "@prisma/client";
import { db } from "@/lib/db";
import { parsePorPagina } from "@/lib/vista-lista";
import type { RangoPeriodo } from "@/lib/periodo-dashboard";

export type FiltrosCorrespondencia = {
  q?: string;
  tipo?: string;
  estado?: string;
  dependencia?: string;
  page?: string;
  vista?: string;
};

const ESTADOS_VALIDOS: EstadoComunicacion[] = [
  "RADICADA",
  "EN_REPARTO",
  "ASIGNADA",
  "EN_TRAMITE",
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
      ],
    });
  }
  if (esEstadoValido(f.estado)) and.push({ estado: f.estado });
  if (f.dependencia) and.push({ OR: [{ dependenciaDestinoId: f.dependencia }, { dependenciaOrigenId: f.dependencia }] });
  if (rango) and.push({ fechaRadicacion: { gte: rango.desde, lt: rango.hasta } });
  return and.length ? { AND: and } : {};
}

export async function getCorrespondenciaListado(filtros: FiltrosCorrespondencia, rango: RangoPeriodo = null) {
  const page = Math.max(1, parseInt(filtros.page ?? "1", 10) || 1);
  const { porPagina, vista } = parsePorPagina(filtros.vista);
  const where = construirWhereCorrespondencia(filtros, rango);

  const [total, filas] = await Promise.all([
    db.comunicacion.count({ where }),
    db.comunicacion.findMany({
      where,
      orderBy: [{ fechaRadicacion: "desc" }, { radicado: "desc" }],
      skip: (page - 1) * porPagina,
      take: porPagina,
      include: {
        dependenciaDestino: { select: { nombre: true } },
        dependenciaOrigen: { select: { nombre: true } },
        _count: { select: { documentos: true } },
      },
    }),
  ]);

  return { filas, total, page, totalPaginas: Math.max(1, Math.ceil(total / porPagina)), porPagina, vista };
}

export async function getCorrespondenciaOpcionesFiltro() {
  const dependencias = await db.dependencia.findMany({
    where: { activo: true },
    orderBy: [{ nivel: "asc" }, { orden: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true },
  });
  return { dependencias, estados: ESTADOS_VALIDOS, tipos: TIPOS_VALIDOS };
}
