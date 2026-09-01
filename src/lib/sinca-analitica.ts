import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

/**
 * Analítica del histórico SINCA 1.0 — inferencia estadística y minería de datos
 * sobre la tabla espejo `SincaResolucion`. El grueso del cálculo se hace en
 * Postgres (percentiles, regresión lineal, correlación) y aquí solo se arma la
 * inferencia final (intervalos de confianza, banda de predicción).
 *
 * Todo va cacheado 1 h porque los datos solo cambian con la sincronización diaria.
 */

const n = (v: unknown) => (typeof v === "bigint" ? Number(v) : Number(v ?? 0));

// --- Inferencia -------------------------------------------------------------

/** Intervalo de Wilson al 95 % para una proporción (más honesto que el normal con n chico). */
function wilson(exitos: number, total: number): { p: number; lo: number; hi: number } {
  if (total === 0) return { p: 0, lo: 0, hi: 0 };
  const z = 1.96;
  const phat = exitos / total;
  const denom = 1 + (z * z) / total;
  const centro = (phat + (z * z) / (2 * total)) / denom;
  const margen = (z * Math.sqrt((phat * (1 - phat)) / total + (z * z) / (4 * total * total))) / denom;
  return { p: phat, lo: Math.max(0, centro - margen), hi: Math.min(1, centro + margen) };
}

export type Analitica = Awaited<ReturnType<typeof calcularAnalitica>>;

export async function calcularAnalitica() {
  const anioActual = new Date().getUTCFullYear();

  const [
    kpiRaw,
    coberturaRaw,
    aprobacionRaw,
    concentracionRaw,
    regresionRaw,
    serieMensualRaw,
    histogramaDiasRaw,
    diasPorAnioRaw,
    diasPorTipoRaw,
    friccionPorTipoRaw,
    paretoMunicipioRaw,
    recurrentesRaw,
    proyectos,
  ] = await Promise.all([
    db.$queryRaw<{ total: bigint; con_dias: bigint; p50: number | null; p90: number | null }[]>`
      SELECT COUNT(*) total,
             COUNT("diasResolucion") con_dias,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY "diasResolucion") p50,
             percentile_cont(0.9) WITHIN GROUP (ORDER BY "diasResolucion") p90
      FROM "SincaResolucion"`,

    db.$queryRaw<{ enriquecidas: bigint; con_nit: bigint }[]>`
      SELECT COUNT("enriquecidoEn") enriquecidas, COUNT("solicitanteNit") con_nit FROM "SincaResolucion"`,

    db.$queryRaw<{ total: bigint; aprobadas: bigint }[]>`
      SELECT COUNT(*) total, COUNT(*) FILTER (WHERE estado = 'Aprobada') aprobadas
      FROM "SincaResolucion" WHERE estado IS NOT NULL`,

    db.$queryRaw<{ municipio: string; c: bigint }[]>`
      SELECT municipio, COUNT(*) c FROM "SincaResolucion"
      WHERE municipio IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`,

    // Regresión lineal de resoluciones/año (años completos)
    db.$queryRaw<
      { slope: number; intercept: number; r2: number; avgx: number; sxx: number; syy: number; cnt: bigint }[]
    >`
      SELECT regr_slope(c, y) slope, regr_intercept(c, y) intercept, regr_r2(c, y) r2,
             regr_avgx(c, y) avgx, regr_sxx(c, y) sxx, regr_syy(c, y) syy, regr_count(c, y) cnt
      FROM (
        SELECT "anioResolucion" y, COUNT(*)::float c
        FROM "SincaResolucion"
        WHERE "anioResolucion" IS NOT NULL AND "anioResolucion" < ${anioActual}
        GROUP BY 1
      ) t`,

    db.$queryRaw<{ anio: number; mes: number; c: bigint }[]>`
      SELECT EXTRACT(YEAR FROM "fechaResolucion")::int anio,
             EXTRACT(MONTH FROM "fechaResolucion")::int mes, COUNT(*) c
      FROM "SincaResolucion" WHERE "fechaResolucion" IS NOT NULL
      GROUP BY 1, 2`,

    db.$queryRaw<{ bucket: string; c: bigint }[]>`
      SELECT CASE
        WHEN "diasResolucion" <= 90 THEN '0-3 meses'
        WHEN "diasResolucion" <= 180 THEN '3-6 meses'
        WHEN "diasResolucion" <= 365 THEN '6-12 meses'
        WHEN "diasResolucion" <= 730 THEN '1-2 años'
        WHEN "diasResolucion" <= 1460 THEN '2-4 años'
        ELSE 'más de 4 años' END bucket,
        COUNT(*) c
      FROM "SincaResolucion" WHERE "diasResolucion" IS NOT NULL GROUP BY 1`,

    db.$queryRaw<{ anio: number; p50: number; p90: number; c: bigint }[]>`
      SELECT "anioResolucion" anio,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY "diasResolucion") p50,
             percentile_cont(0.9) WITHIN GROUP (ORDER BY "diasResolucion") p90,
             COUNT(*) c
      FROM "SincaResolucion"
      WHERE "diasResolucion" IS NOT NULL AND "anioResolucion" IS NOT NULL
      GROUP BY 1 ORDER BY 1`,

    db.$queryRaw<{ tipo: string; p50: number; c: bigint }[]>`
      SELECT "tipoSolicitudNombre" tipo,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY "diasResolucion") p50,
             COUNT(*) c
      FROM "SincaResolucion"
      WHERE "diasResolucion" IS NOT NULL AND "tipoSolicitudNombre" IS NOT NULL
      GROUP BY 1 HAVING COUNT(*) >= 15 ORDER BY 2 DESC LIMIT 12`,

    db.$queryRaw<{ tipo: string; total: bigint; no_aprobadas: bigint }[]>`
      SELECT "tipoSolicitudNombre" tipo, COUNT(*) total,
             COUNT(*) FILTER (WHERE estado <> 'Aprobada') no_aprobadas
      FROM "SincaResolucion"
      WHERE "tipoSolicitudNombre" IS NOT NULL AND estado IS NOT NULL
      GROUP BY 1 HAVING COUNT(*) >= 20 ORDER BY 2 DESC LIMIT 12`,

    db.$queryRaw<{ municipio: string; c: bigint }[]>`
      SELECT municipio, COUNT(*) c FROM "SincaResolucion"
      WHERE municipio IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`,

    db.$queryRaw<{ nit: string; nombre: string | null; c: bigint; anios: bigint; tipos: bigint }[]>`
      SELECT "solicitanteNit" nit, MAX("solicitanteNombre") nombre, COUNT(*) c,
             COUNT(DISTINCT "anioResolucion") anios, COUNT(DISTINCT "tipoSolicitudCodigo") tipos
      FROM "SincaResolucion"
      WHERE "solicitanteNit" IS NOT NULL
        AND length("solicitanteNit") >= 5
        AND "solicitanteNit" NOT IN ('9999999999', '99999999', '999999999', '0000000000', '00000000', '1111111111', '12345678', '123456789')
      GROUP BY 1 ORDER BY 3 DESC LIMIT 15`,

    db.sincaResolucion.findMany({ select: { proyecto: true } }),
  ]);

  // KPI tiempo de resolución
  const diasP50 = kpiRaw[0]?.p50 != null ? Math.round(kpiRaw[0].p50) : null;
  const diasP90 = kpiRaw[0]?.p90 != null ? Math.round(kpiRaw[0].p90) : null;
  const total = n(kpiRaw[0]?.total);
  const coberturaDias = total ? n(kpiRaw[0]?.con_dias) / total : 0;
  const coberturaNit = total ? n(coberturaRaw[0]?.con_nit) / total : 0;

  // Tasa de aprobación con IC de Wilson
  const aprob = wilson(n(aprobacionRaw[0]?.aprobadas), n(aprobacionRaw[0]?.total));

  // Concentración geográfica (HHI normalizado 0..1) + share top 5
  const totMun = concentracionRaw.reduce((a, r) => a + n(r.c), 0);
  const hhi = concentracionRaw.reduce((a, r) => a + Math.pow(n(r.c) / totMun, 2), 0);
  const kMun = concentracionRaw.length;
  const hhiNorm = kMun > 1 ? (hhi - 1 / kMun) / (1 - 1 / kMun) : 0;
  const top5Mun = concentracionRaw.slice(0, 5).reduce((a, r) => a + n(r.c), 0) / totMun;

  // Volumen últimos 12 meses vs 12 previos
  const mesesOrden = serieMensualRaw
    .map((r) => ({ ym: r.anio * 12 + (r.mes - 1), c: n(r.c) }))
    .sort((a, b) => a.ym - b.ym);
  const hoyYm = new Date().getUTCFullYear() * 12 + new Date().getUTCMonth();
  const ventana = (desde: number, hasta: number) =>
    mesesOrden.filter((m) => m.ym > desde && m.ym <= hasta).reduce((a, m) => a + m.c, 0);
  const ult12 = ventana(hoyYm - 12, hoyYm);
  const prev12 = ventana(hoyYm - 24, hoyYm - 12);
  const cambio12 = prev12 > 0 ? (ult12 - prev12) / prev12 : null;

  // --- Pronóstico (regresión lineal + banda de predicción ~95%) ---
  const g = regresionRaw[0];
  let pronostico: {
    historico: { anio: number; valor: number }[];
    proyeccion: { anio: number; valor: number; lo: number; hi: number }[];
    pendiente: number;
    r2: number;
  } | null = null;
  if (g && g.slope != null && n(g.cnt) >= 4) {
    const cnt = n(g.cnt);
    const sErr = Math.sqrt((g.syy * (1 - g.r2)) / Math.max(1, cnt - 2)); // desv. residual
    const historico = (
      await db.$queryRaw<{ anio: number; c: bigint }[]>`
        SELECT "anioResolucion" anio, COUNT(*) c FROM "SincaResolucion"
        WHERE "anioResolucion" IS NOT NULL AND "anioResolucion" < ${anioActual}
        GROUP BY 1 ORDER BY 1`
    ).map((r) => ({ anio: r.anio, valor: n(r.c) }));
    const proyeccion = [anioActual, anioActual + 1, anioActual + 2].map((y) => {
      const yhat = g.slope * y + g.intercept;
      const se = sErr * Math.sqrt(1 + 1 / cnt + Math.pow(y - g.avgx, 2) / g.sxx);
      return { anio: y, valor: Math.max(0, Math.round(yhat)), lo: Math.max(0, Math.round(yhat - 1.96 * se)), hi: Math.round(yhat + 1.96 * se) };
    });
    pronostico = { historico, proyeccion, pendiente: g.slope, r2: g.r2 };
  }

  // Estacionalidad: matriz año×mes + índice estacional por mes
  const aniosMatriz = [...new Set(serieMensualRaw.map((r) => r.anio))].sort();
  const heatmap = aniosMatriz.map((anio) => ({
    anio,
    meses: Array.from({ length: 12 }, (_, m) => n(serieMensualRaw.find((r) => r.anio === anio && r.mes === m + 1)?.c)),
  }));
  const promMes = Array.from({ length: 12 }, (_, m) => {
    const vals = serieMensualRaw.filter((r) => r.mes === m + 1).map((r) => n(r.c));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });
  const promGlobal = promMes.reduce((a, b) => a + b, 0) / 12 || 1;
  const indiceEstacional = promMes.map((v, m) => ({ mes: m + 1, indice: v / promGlobal }));

  // Histograma de días
  const ordenBuckets = ["0-3 meses", "3-6 meses", "6-12 meses", "1-2 años", "2-4 años", "más de 4 años"];
  const histogramaDias = ordenBuckets
    .map((b) => ({ label: b, value: n(histogramaDiasRaw.find((r) => r.bucket === b)?.c) }))
    .filter((x) => x.value > 0);

  // Fricción por tipo (% no aprobada, con IC Wilson)
  const friccionPorTipo = friccionPorTipoRaw
    .map((r) => {
      const w = wilson(n(r.no_aprobadas), n(r.total));
      return { tipo: r.tipo, total: n(r.total), pct: w.p, lo: w.lo, hi: w.hi };
    })
    .sort((a, b) => b.pct - a.pct);

  // Pareto municipios
  let acum = 0;
  const paretoTotal = paretoMunicipioRaw.reduce((a, r) => a + n(r.c), 0);
  const pareto = paretoMunicipioRaw.map((r) => {
    acum += n(r.c);
    return { municipio: r.municipio, valor: n(r.c), acumPct: acum / paretoTotal };
  });
  const municipios80 = pareto.findIndex((p) => p.acumPct >= 0.8) + 1;

  // Minería de texto sobre `proyecto`
  const textos = proyectos.map((p) => p.proyecto).filter(Boolean);
  const mineriaTexto = minarTexto(textos);

  return {
    total,
    coberturaDias,
    coberturaNit,
    enriquecidas: n(coberturaRaw[0]?.enriquecidas),
    diasP50,
    diasP90,
    aprobacion: aprob,
    concentracion: { hhi: hhiNorm, top5: top5Mun, municipios: kMun },
    volumen: { ult12, prev12, cambio12 },
    pronostico,
    heatmap,
    indiceEstacional,
    histogramaDias,
    diasPorAnio: diasPorAnioRaw.map((r) => ({ anio: r.anio, p50: Math.round(r.p50), p90: Math.round(r.p90), n: n(r.c) })),
    diasPorTipo: diasPorTipoRaw.map((r) => ({ label: r.tipo, value: Math.round(r.p50), n: n(r.c) })),
    friccionPorTipo,
    pareto,
    municipios80,
    recurrentes: recurrentesRaw.map((r) => ({
      nit: r.nit,
      nombre: r.nombre,
      total: n(r.c),
      anios: n(r.anios),
      tipos: n(r.tipos),
    })),
    mineriaTexto,
  };
}

// --- Minería de texto ------------------------------------------------------

const STOPWORDS = new Set(
  ("de la el en y a los las del un una para por con no se su lo como mas pero sus le ya o este si porque " +
    "esta entre cuando muy sin sobre tambien me hasta hay donde han quien estan estado desde todo nos durante " +
    "e n al que es dpto departamento santander numero radicado fecha ubicada ubicado sr sra")
    .split(/\s+/)
);

function normaliza(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ");
}

function minarTexto(textos: string[]) {
  const uni = new Map<string, number>();
  const bi = new Map<string, number>();
  for (const t of textos) {
    const toks = normaliza(t)
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
    for (const w of toks) uni.set(w, (uni.get(w) ?? 0) + 1);
    for (let i = 0; i < toks.length - 1; i++) {
      const b = `${toks[i]} ${toks[i + 1]}`;
      bi.set(b, (bi.get(b) ?? 0) + 1);
    }
  }
  const top = (m: Map<string, number>, k: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([label, value]) => ({ label, value }));
  return { terminos: top(uni, 40), frases: top(bi, 20) };
}

export const getAnalitica = unstable_cache(calcularAnalitica, ["sinca-analitica"], {
  revalidate: 3600,
  tags: ["sinca-analitica"],
});
