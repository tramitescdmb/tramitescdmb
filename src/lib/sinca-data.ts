import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** Datos agregados para el panel de /historico (SINCA 1.0). */
export async function getHistoricoDashboard() {
  const [total, aprobadas, conResolucion, diasRaw, porAnioRaw, porTipoRaw, porEstadoRaw, porMunicipioRaw, recientes, ultimaSync] =
    await Promise.all([
      db.sincaResolucion.count(),
      db.sincaResolucion.count({ where: { estado: "Aprobada" } }),
      db.sincaResolucion.count({ where: { numeroResolucion: { not: null } } }),
      db.$queryRaw<{ p50: number | null; con: bigint }[]>`
        SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY "diasResolucion") p50,
               COUNT("diasResolucion") con
        FROM "SincaResolucion"`,
      db.sincaResolucion.groupBy({
        by: ["anioResolucion"],
        _count: { _all: true },
        where: { anioResolucion: { not: null } },
        orderBy: { anioResolucion: "asc" },
      }),
      db.sincaResolucion.groupBy({
        by: ["tipoSolicitudNombre"],
        _count: { _all: true },
        orderBy: { _count: { tipoSolicitudNombre: "desc" } },
        take: 10,
      }),
      db.sincaResolucion.groupBy({
        by: ["estado"],
        _count: { _all: true },
        orderBy: { _count: { estado: "desc" } },
      }),
      db.sincaResolucion.groupBy({
        by: ["municipio"],
        _count: { _all: true },
        where: { municipio: { not: null } },
        orderBy: { _count: { municipio: "desc" } },
        take: 10,
      }),
      db.sincaResolucion.findMany({
        take: 8,
        orderBy: [{ fechaResolucion: { sort: "desc", nulls: "last" } }, { nroSolicitud: "desc" }],
        select: {
          nroSolicitud: true,
          numeroResolucion: true,
          fechaResolucion: true,
          tipoSolicitudNombre: true,
          municipio: true,
          expediente: true,
          proyecto: true,
        },
      }),
      db.sincaSincronizacion.findFirst({ orderBy: { iniciadoEn: "desc" } }),
    ]);

  // Serie por año, rellenando los años sin resoluciones para que la tendencia no salte huecos.
  const anios = porAnioRaw.map((a) => a.anioResolucion as number);
  const serieAnual: { label: string; value: number }[] = [];
  if (anios.length > 0) {
    const desde = Math.min(...anios);
    const hasta = Math.max(...anios);
    for (let y = desde; y <= hasta; y++) {
      const fila = porAnioRaw.find((a) => a.anioResolucion === y);
      serieAnual.push({ label: String(y), value: fila?._count._all ?? 0 });
    }
  }

  return {
    total,
    aprobadas,
    tasaAprobacion: total ? aprobadas / total : 0,
    conResolucion,
    diasResolucionP50: diasRaw[0]?.p50 != null ? Math.round(diasRaw[0].p50) : null,
    diasResolucionCobertura: total ? Number(diasRaw[0]?.con ?? 0) / total : 0,
    sinFechaValida: total - porAnioRaw.reduce((acc, a) => acc + a._count._all, 0),
    serieAnual,
    porTipo: porTipoRaw.map((t) => ({ label: t.tipoSolicitudNombre ?? "Sin clasificar", value: t._count._all })),
    porEstado: porEstadoRaw.map((e) => ({ label: e.estado ?? "Sin estado", value: e._count._all })),
    porMunicipio: porMunicipioRaw.map((m) => ({ label: m.municipio ?? "—", value: m._count._all })),
    recientes,
    ultimaSync,
  };
}

export type FiltrosHistorico = {
  q?: string;
  anio?: string;
  tipo?: string;
  municipio?: string;
  estado?: string;
  page?: string;
};

const POR_PAGINA = 25;

export function construirWhereHistorico(filtros: FiltrosHistorico): Prisma.SincaResolucionWhereInput {
  const where: Prisma.SincaResolucionWhereInput = {};
  const and: Prisma.SincaResolucionWhereInput[] = [];

  if (filtros.q?.trim()) {
    const q = filtros.q.trim();
    const comoNumero = parseInt(q.replace(/\D/g, ""), 10);
    and.push({
      OR: [
        { proyecto: { contains: q, mode: "insensitive" } },
        { expediente: { contains: q, mode: "insensitive" } },
        { numeroResolucion: { contains: q, mode: "insensitive" } },
        { representanteLegal: { contains: q, mode: "insensitive" } },
        ...(Number.isFinite(comoNumero) ? [{ nroSolicitud: comoNumero }] : []),
      ],
    });
  }
  if (filtros.anio && /^\d{4}$/.test(filtros.anio)) and.push({ anioResolucion: parseInt(filtros.anio, 10) });
  if (filtros.tipo?.trim()) and.push({ tipoSolicitudCodigo: filtros.tipo.trim() });
  if (filtros.municipio?.trim()) and.push({ municipio: filtros.municipio.trim() });
  if (filtros.estado?.trim()) and.push({ estado: filtros.estado.trim() });
  if (and.length > 0) where.AND = and;
  return where;
}

/** Listado paginado de /historico/solicitudes con los filtros de la barra. */
export async function getHistoricoListado(filtros: FiltrosHistorico) {
  const page = Math.max(1, parseInt(filtros.page ?? "1", 10) || 1);
  const where = construirWhereHistorico(filtros);

  const [total, filas] = await Promise.all([
    db.sincaResolucion.count({ where }),
    db.sincaResolucion.findMany({
      where,
      orderBy: [{ fechaResolucion: { sort: "desc", nulls: "last" } }, { nroSolicitud: "desc" }],
      skip: (page - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        nroSolicitud: true,
        numeroResolucion: true,
        fechaResolucion: true,
        tipoSolicitudNombre: true,
        tipoSolicitudCodigo: true,
        estado: true,
        municipio: true,
        expediente: true,
        proyecto: true,
      },
    }),
  ]);

  return {
    filas,
    total,
    page,
    totalPaginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    porPagina: POR_PAGINA,
  };
}

/** Opciones para los desplegables de filtro (valores realmente presentes en los datos). */
export async function getHistoricoOpcionesFiltro() {
  const [tipos, municipios, estados, anios] = await Promise.all([
    db.sincaResolucion.groupBy({
      by: ["tipoSolicitudCodigo", "tipoSolicitudNombre"],
      _count: { _all: true },
      where: { tipoSolicitudCodigo: { not: null } },
      orderBy: { _count: { tipoSolicitudCodigo: "desc" } },
    }),
    db.sincaResolucion.groupBy({
      by: ["municipio"],
      where: { municipio: { not: null } },
      _count: { _all: true },
      orderBy: { municipio: "asc" },
    }),
    db.sincaResolucion.groupBy({
      by: ["estado"],
      where: { estado: { not: null } },
      _count: { _all: true },
      orderBy: { estado: "asc" },
    }),
    db.sincaResolucion.groupBy({
      by: ["anioResolucion"],
      where: { anioResolucion: { not: null } },
      _count: { _all: true },
      orderBy: { anioResolucion: "desc" },
    }),
  ]);

  return {
    tipos: tipos.map((t) => ({ codigo: t.tipoSolicitudCodigo!, nombre: t.tipoSolicitudNombre ?? t.tipoSolicitudCodigo!, total: t._count._all })),
    municipios: municipios.map((m) => ({ nombre: m.municipio!, total: m._count._all })),
    estados: estados.map((e) => ({ nombre: e.estado!, total: e._count._all })),
    anios: anios.map((a) => a.anioResolucion as number),
  };
}

export async function getHistoricoResolucion(nroSolicitud: number) {
  return db.sincaResolucion.findUnique({ where: { nroSolicitud } });
}
