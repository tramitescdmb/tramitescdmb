import { db } from "@/lib/db";

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

export async function getDashboardData() {
  const [totalTramites, totalExpedientes, porEstado, recientes, porMunicipioRaw, porTramiteRaw, mensualRaw] =
    await Promise.all([
      db.tramiteTipo.count({ where: { activo: true } }),
      db.expediente.count(),
      db.expediente.groupBy({ by: ["estado"], _count: { _all: true } }),
      db.expediente.findMany({
        take: 8,
        orderBy: { fechaUltimoMovimiento: "desc" },
        include: { tramiteTipo: true, flujo: { include: { pasos: { select: { id: true } } } } },
      }),
      db.expediente.groupBy({
        by: ["municipio"],
        _count: { _all: true },
        orderBy: { _count: { municipio: "desc" } },
        take: 10,
      }),
      db.expediente.groupBy({
        by: ["tramiteTipoId"],
        _count: { _all: true },
        orderBy: { _count: { tramiteTipoId: "desc" } },
        take: 10,
      }),
      db.$queryRaw<{ mes: Date; total: bigint }[]>`
        SELECT date_trunc('month', "fechaRadicacion") as mes, COUNT(*)::bigint as total
        FROM "Expediente"
        WHERE "fechaRadicacion" >= now() - interval '12 months'
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

  // completar los 12 meses (incluye los que tienen 0) para que la tendencia no tenga huecos
  const ahora = new Date();
  const serieMensual: { label: string; value: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const fila = mensualRaw.find((m) => {
      const mesFecha = new Date(m.mes);
      return mesFecha.getFullYear() === d.getFullYear() && mesFecha.getMonth() === d.getMonth();
    });
    serieMensual.push({ label: MESES_CORTOS[d.getMonth()], value: fila ? Number(fila.total) : 0 });
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
