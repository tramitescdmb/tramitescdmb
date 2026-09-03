import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { NOMBRE_TRAMITE_VITAL, nombreTramiteVital } from "@/lib/vital";
import { parsePorPagina } from "@/lib/vista-lista";
import type { RangoPeriodo } from "@/lib/periodo-dashboard";

const num = (v: unknown) => (typeof v === "bigint" ? Number(v) : Number(v ?? 0));
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MAX_MESES_SERIE = 120;

export type FiltrosVital = { q?: string; tramite?: string; anio?: string; actividad?: string; page?: string; vista?: string };

export function construirWhereVital(f: FiltrosVital): Prisma.SolicitudVitalWhereInput {
  const and: Prisma.SolicitudVitalWhereInput[] = [];
  if (f.q?.trim()) {
    const q = f.q.trim();
    and.push({
      OR: [
        { idVital: { contains: q } },
        { solicitanteNombre: { contains: q, mode: "insensitive" } },
        { solicitanteIdentificacion: { contains: q } },
        { nombreActividad: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (f.tramite && /^\d+$/.test(f.tramite)) and.push({ idTramiteVital: parseInt(f.tramite, 10) });
  if (f.actividad?.trim()) and.push({ nombreActividad: f.actividad.trim() });
  if (f.anio && /^\d{4}$/.test(f.anio)) {
    const y = parseInt(f.anio, 10);
    and.push({ fechaRadicacion: { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) } });
  }
  return and.length ? { AND: and } : {};
}

/** Listado paginado de /vital con la barra de filtros. `filtros.vista` elige cuántos por página (50/100/150/200/todos). */
export async function getVitalListado(filtros: FiltrosVital) {
  const page = Math.max(1, parseInt(filtros.page ?? "1", 10) || 1);
  const { porPagina, vista } = parsePorPagina(filtros.vista);
  const where = construirWhereVital(filtros);

  const [total, filas] = await Promise.all([
    db.solicitudVital.count({ where }),
    db.solicitudVital.findMany({
      where,
      orderBy: [{ fechaRadicacion: { sort: "desc", nulls: "last" } }, { ultimaSincronizacion: "desc" }],
      skip: (page - 1) * porPagina,
      take: porPagina,
      include: { _count: { select: { documentos: true } } },
    }),
  ]);

  return { filas, total, page, totalPaginas: Math.max(1, Math.ceil(total / porPagina)), porPagina, vista };
}

export async function getVitalOpcionesFiltro() {
  const [tramites, actividades, anios] = await Promise.all([
    db.solicitudVital.groupBy({ by: ["idTramiteVital"], _count: { _all: true }, orderBy: { _count: { idTramiteVital: "desc" } } }),
    db.solicitudVital.groupBy({
      by: ["nombreActividad"],
      where: { nombreActividad: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { nombreActividad: "desc" } },
    }),
    db.$queryRaw<{ anio: number; c: bigint }[]>`
      SELECT EXTRACT(YEAR FROM "fechaRadicacion")::int anio, COUNT(*) c
      FROM "SolicitudVital" WHERE "fechaRadicacion" IS NOT NULL
      GROUP BY 1 ORDER BY 1 DESC`,
  ]);
  return {
    tramites: tramites.map((t) => ({ id: t.idTramiteVital, nombre: NOMBRE_TRAMITE_VITAL[t.idTramiteVital] ?? `Trámite ${t.idTramiteVital}`, total: t._count._all })),
    actividades: actividades.map((a) => ({ nombre: a.nombreActividad!, total: a._count._all })),
    anios: anios.map((a) => a.anio),
  };
}

/** Las 10 solicitudes más recientes por fecha de radicación (o de sincronización si no hay fecha). */
export async function getVitalUltimasRadicadas(n = 10) {
  return db.solicitudVital.findMany({
    orderBy: [{ fechaRadicacion: { sort: "desc", nulls: "last" } }, { ultimaSincronizacion: "desc" }],
    take: n,
    select: {
      id: true,
      idVital: true,
      idTramiteVital: true,
      nombreActividad: true,
      solicitanteNombre: true,
      solicitanteIdentificacion: true,
      fechaRadicacion: true,
      ultimaSincronizacion: true,
      _count: { select: { documentos: true } },
    },
  });
}

/** Datos agregados para /vital/dashboard. */
/**
 * `periodo`: `null` = Total, todo el histórico (comportamiento de siempre).
 * Con un rango, todo el tablero queda acotado a `fechaRadicacion` dentro de
 * [desde, hasta) — incluida la serie mensual, que pasa a recorrer
 * exactamente ese rango en vez de un trailing fijo de 24 meses.
 */
export async function getVitalDashboard(periodo: RangoPeriodo = null) {
  const filtroFecha: Prisma.SolicitudVitalWhereInput = periodo ? { fechaRadicacion: { gte: periodo.desde, lt: periodo.hasta } } : {};
  const condicionMensualSql = periodo
    ? Prisma.sql`"fechaRadicacion" >= ${periodo.desde} AND "fechaRadicacion" < ${periodo.hasta}`
    : Prisma.sql`"fechaRadicacion" >= now() - interval '24 months'`;

  const [total, conDocs, porTramiteRaw, porActividadRaw, mensualRaw, anualRaw, recurrentesRaw, ultimaSyncRaw] =
    await Promise.all([
      db.solicitudVital.count({ where: filtroFecha }),
      db.solicitudVital.count({ where: { ...filtroFecha, documentos: { some: {} } } }),
      db.solicitudVital.groupBy({ by: ["idTramiteVital"], where: filtroFecha, _count: { _all: true }, orderBy: { _count: { idTramiteVital: "desc" } } }),
      db.solicitudVital.groupBy({
        by: ["nombreActividad"],
        where: { ...filtroFecha, nombreActividad: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { nombreActividad: "desc" } },
        take: 10,
      }),
      db.$queryRaw<{ mes: Date; c: bigint }[]>`
        SELECT date_trunc('month', "fechaRadicacion") mes, COUNT(*) c
        FROM "SolicitudVital"
        WHERE ${condicionMensualSql}
        GROUP BY 1 ORDER BY 1`,
      db.$queryRaw<{ anio: number; c: bigint }[]>`
        SELECT EXTRACT(YEAR FROM "fechaRadicacion")::int anio, COUNT(*) c
        FROM "SolicitudVital" WHERE "fechaRadicacion" IS NOT NULL AND ${condicionMensualSql}
        GROUP BY 1 ORDER BY 1`,
      db.$queryRaw<{ nit: string; nombre: string | null; c: bigint; tramites: bigint }[]>`
        SELECT "solicitanteIdentificacion" nit, MAX("solicitanteNombre") nombre, COUNT(*) c,
               COUNT(DISTINCT "idTramiteVital") tramites
        FROM "SolicitudVital"
        WHERE "solicitanteIdentificacion" IS NOT NULL
          AND "solicitanteIdentificacion" NOT IN ('00000001', '0', '1', '9999999999')
          AND length("solicitanteIdentificacion") >= 5
          AND ${condicionMensualSql}
        GROUP BY 1 ORDER BY 3 DESC LIMIT 10`,
      db.solicitudVital.aggregate({ _max: { ultimaSincronizacion: true } }),
    ]);

  // serie mensual: recorre exactamente el rango elegido (o el trailing de 24 meses de siempre si es "Total").
  const hastaSerie = periodo ? new Date(periodo.hasta.getTime() - 1) : new Date();
  const desdeSerie = periodo ? periodo.desde : new Date(hastaSerie.getFullYear(), hastaSerie.getMonth() - 23, 1);
  const totalMeses = Math.min(
    MAX_MESES_SERIE,
    Math.max(1, (hastaSerie.getFullYear() - desdeSerie.getFullYear()) * 12 + (hastaSerie.getMonth() - desdeSerie.getMonth()) + 1)
  );
  const serieMensual: { label: string; value: number }[] = [];
  for (let i = 0; i < totalMeses; i++) {
    const d = new Date(desdeSerie.getFullYear(), desdeSerie.getMonth() + i, 1);
    const fila = mensualRaw.find((m) => {
      const md = new Date(m.mes);
      return md.getUTCFullYear() === d.getFullYear() && md.getUTCMonth() === d.getMonth();
    });
    serieMensual.push({ label: `${MESES_CORTOS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, value: fila ? num(fila.c) : 0 });
  }

  const aniosNums = anualRaw.map((a) => a.anio);
  const serieAnual: { anio: number; valor: number }[] = [];
  if (aniosNums.length) {
    for (let y = Math.min(...aniosNums); y <= Math.max(...aniosNums); y++) {
      serieAnual.push({ anio: y, valor: num(anualRaw.find((a) => a.anio === y)?.c) });
    }
  }

  return {
    total,
    conDocs,
    tramitesDistintos: porTramiteRaw.length,
    porTramite: porTramiteRaw.map((t) => ({ label: nombreTramiteVital(t.idTramiteVital), value: t._count._all })),
    porActividad: porActividadRaw.map((a) => ({ label: a.nombreActividad ?? "—", value: a._count._all })),
    serieMensual,
    serieAnual,
    recurrentes: recurrentesRaw.map((r) => ({ nit: r.nit, nombre: r.nombre, total: num(r.c), tramites: num(r.tramites) })),
    ultimaSync: ultimaSyncRaw._max.ultimaSincronizacion,
  };
}
