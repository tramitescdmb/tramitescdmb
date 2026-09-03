import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { RangoPeriodo } from "@/lib/periodo-dashboard";

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const MAX_MESES_SERIE = 120; // tope defensivo (10 años) para un rango personalizado inusualmente largo

/**
 * `tramiteIds`: `null` = sin restricción (ADMIN); un arreglo (incluso vacío)
 * = un FUNCIONARIO, solo cuenta/lista expedientes de esos trámites — antes
 * el panel mostraba totales y actividad de TODA la CDMB sin importar el
 * acceso real del usuario, lo que contradice el modelo "denegado por
 * defecto" de los trámites (ver [[project-acceso-por-tramite]]).
 *
 * `periodo`: `null` = Total, todo el histórico (comportamiento de siempre).
 * Con un rango, TODA la información del panel queda acotada a
 * `fechaRadicacion` dentro de [desde, hasta) — KPIs, listados por
 * municipio/trámite y la serie mensual (que además pasa a recorrer
 * exactamente ese rango, no un trailing fijo de 12 meses).
 */
export async function getDashboardData(tramiteIds: string[] | null, periodo: RangoPeriodo = null) {
  const filtroTramite: Prisma.ExpedienteWhereInput = tramiteIds ? { tramiteTipoId: { in: tramiteIds } } : {};
  const filtroFecha: Prisma.ExpedienteWhereInput = periodo ? { fechaRadicacion: { gte: periodo.desde, lt: periodo.hasta } } : {};
  const filtroCombinado: Prisma.ExpedienteWhereInput = { AND: [filtroTramite, filtroFecha] };

  // `false` cuando tramiteIds es un arreglo vacío (funcionario sin ningún trámite asignado) hace que
  // el WHERE no devuelva ninguna fila — SQL válido, evita un IN () vacío (que sería un error de sintaxis).
  const condicionesSql: Prisma.Sql[] = [
    periodo
      ? Prisma.sql`"fechaRadicacion" >= ${periodo.desde} AND "fechaRadicacion" < ${periodo.hasta}`
      : Prisma.sql`"fechaRadicacion" >= now() - interval '12 months'`,
  ];
  if (tramiteIds) {
    condicionesSql.push(tramiteIds.length > 0 ? Prisma.sql`"tramiteTipoId" IN (${Prisma.join(tramiteIds)})` : Prisma.sql`false`);
  }
  const whereSql = Prisma.join(condicionesSql, " AND ");

  const [totalTramites, totalExpedientes, porEstado, recientes, porMunicipioRaw, porTramiteRaw, mensualRaw] =
    await Promise.all([
      tramiteIds ? tramiteIds.length : db.tramiteTipo.count({ where: { activo: true } }),
      db.expediente.count({ where: filtroCombinado }),
      db.expediente.groupBy({ by: ["estado"], where: filtroCombinado, _count: { _all: true } }),
      db.expediente.findMany({
        where: filtroTramite,
        take: 8,
        orderBy: { fechaUltimoMovimiento: "desc" },
        include: { tramiteTipo: true, flujo: { include: { pasos: { select: { id: true } } } } },
      }),
      db.expediente.groupBy({
        by: ["municipio"],
        where: filtroCombinado,
        _count: { _all: true },
        orderBy: { _count: { municipio: "desc" } },
        take: 10,
      }),
      db.expediente.groupBy({
        by: ["tramiteTipoId"],
        where: filtroCombinado,
        _count: { _all: true },
        orderBy: { _count: { tramiteTipoId: "desc" } },
        take: 10,
      }),
      db.$queryRaw<{ mes: Date; total: bigint }[]>`
        SELECT date_trunc('month', "fechaRadicacion") as mes, COUNT(*)::bigint as total
        FROM "Expediente"
        WHERE ${whereSql}
        GROUP BY 1
      `,
    ]);

  const conteoPorEstado = Object.fromEntries(porEstado.map((p) => [p.estado, p._count._all])) as Record<
    string,
    number
  >;
  const activos =
    (conteoPorEstado.RADICADO ?? 0) +
    (conteoPorEstado.EN_TRAMITE ?? 0) +
    (conteoPorEstado.INFORMACION_ADICIONAL_REQUERIDA ?? 0) +
    (conteoPorEstado.SUSPENDIDO ?? 0);
  const aprobados = conteoPorEstado.APROBADO ?? 0;
  const negados = (conteoPorEstado.NEGADO ?? 0) + (conteoPorEstado.RECHAZADO ?? 0);
  const decididos = aprobados + negados;
  const tasaAprobacion = decididos > 0 ? Math.round((aprobados / decididos) * 100) : null;

  const tramitesPorId = await db.tramiteTipo.findMany({
    where: { id: { in: porTramiteRaw.map((p) => p.tramiteTipoId) } },
    select: { id: true, nombre: true },
  });
  const nombreTramite = Object.fromEntries(tramitesPorId.map((t) => [t.id, t.nombre]));

  const topMunicipios = porMunicipioRaw.map((p) => ({ label: p.municipio, value: p._count._all }));
  const topTramites = porTramiteRaw
    .map((p) => ({ label: nombreTramite[p.tramiteTipoId] ?? "—", value: p._count._all }))
    .sort((a, b) => b.value - a.value);

  // Recorre exactamente el rango elegido (o el trailing de 12 meses de siempre si es "Total"),
  // completando con 0 los meses sin radicaciones para que la tendencia no tenga huecos.
  const hastaSerie = periodo ? new Date(periodo.hasta.getTime() - 1) : new Date();
  const desdeSerie = periodo ? periodo.desde : new Date(hastaSerie.getFullYear(), hastaSerie.getMonth() - 11, 1);
  const totalMeses = Math.min(
    MAX_MESES_SERIE,
    Math.max(1, (hastaSerie.getFullYear() - desdeSerie.getFullYear()) * 12 + (hastaSerie.getMonth() - desdeSerie.getMonth()) + 1)
  );
  const serieMensual: { label: string; value: number }[] = [];
  for (let i = 0; i < totalMeses; i++) {
    const d = new Date(desdeSerie.getFullYear(), desdeSerie.getMonth() + i, 1);
    const fila = mensualRaw.find((m) => {
      const mesFecha = new Date(m.mes);
      return mesFecha.getFullYear() === d.getFullYear() && mesFecha.getMonth() === d.getMonth();
    });
    const etiqueta = totalMeses > 24 ? `${MESES_CORTOS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` : MESES_CORTOS[d.getMonth()];
    serieMensual.push({ label: etiqueta, value: fila ? Number(fila.total) : 0 });
  }

  return {
    totalTramites,
    totalExpedientes,
    activos,
    aprobados,
    negados,
    tasaAprobacion,
    recientes,
    topMunicipios,
    topTramites,
    serieMensual,
  };
}
