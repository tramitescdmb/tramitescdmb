import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import type { RangoPeriodo } from "@/lib/periodo-dashboard";

/**
 * Minería de datos / KDD sobre el histórico SINCA 1.0.
 *
 * Todo corre en el servidor sobre las filas del espejo dentro del período
 * elegido (o todo el histórico si es Total). Los algoritmos van
 * implementados a mano — sin librerías de ML — para que sean auditables:
 *   - k-means  → segmentación de municipios por perfil de trámite
 *   - z-score robusto (mediana/MAD) → meses atípicos
 *   - vallas de Tukey (IQR) → resoluciones con tiempo de trámite atípico
 *   - Naive Bayes → factores que suben/bajan la probabilidad de aprobación
 *   - regresión de dos segmentos → año de quiebre en la actividad
 *
 * Con un período corto estas técnicas pueden quedar sin suficientes datos
 * para ser válidas (ej. el pronóstico exige años completos) — cada una ya
 * se apaga sola en ese caso (ver los `if` de tamaño mínimo más abajo), la
 * página solo oculta la tarjeta correspondiente.
 */

type Fila = {
  anioResolucion: number | null;
  tipoSolicitudCodigo: string | null;
  tipoSolicitudNombre: string | null;
  municipio: string | null;
  estado: string | null;
  indTipoSolicitud: string | null;
  diasResolucion: number | null;
  fechaResolucion: Date | null;
};

// ---------- utilidades estadísticas ----------

const mediana = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const cuantil = (xs: number[], q: number) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (pos - lo);
};

// ---------- k-means ----------

function kmeans(vectores: number[][], k: number, iteraciones = 40) {
  if (vectores.length <= k) return vectores.map((_, i) => i);
  const dim = vectores[0].length;
  // init determinista: k puntos espaciados
  let centros = Array.from({ length: k }, (_, i) => [...vectores[Math.floor((i * vectores.length) / k)]]);
  const asign = new Array(vectores.length).fill(0);
  const dist2 = (a: number[], b: number[]) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);

  for (let it = 0; it < iteraciones; it++) {
    let cambio = false;
    for (let i = 0; i < vectores.length; i++) {
      let mejor = 0;
      let md = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist2(vectores[i], centros[c]);
        if (d < md) {
          md = d;
          mejor = c;
        }
      }
      if (asign[i] !== mejor) {
        asign[i] = mejor;
        cambio = true;
      }
    }
    const nuevos = Array.from({ length: k }, () => new Array(dim).fill(0));
    const cuenta = new Array(k).fill(0);
    for (let i = 0; i < vectores.length; i++) {
      cuenta[asign[i]]++;
      for (let d = 0; d < dim; d++) nuevos[asign[i]][d] += vectores[i][d];
    }
    for (let c = 0; c < k; c++) if (cuenta[c] > 0) for (let d = 0; d < dim; d++) nuevos[c][d] /= cuenta[c];
    centros = nuevos.map((c, idx) => (cuenta[idx] > 0 ? c : centros[idx]));
    if (!cambio && it > 0) break;
  }
  return asign;
}

// ---------- cálculo principal ----------

export type Mineria = Awaited<ReturnType<typeof calcularMineria>>;

export async function calcularMineria(periodo: RangoPeriodo = null) {
  const filtroFecha = periodo ? { fechaResolucion: { gte: periodo.desde, lt: periodo.hasta } } : {};
  const filas: Fila[] = await db.sincaResolucion.findMany({
    where: filtroFecha,
    select: {
      anioResolucion: true,
      tipoSolicitudCodigo: true,
      tipoSolicitudNombre: true,
      municipio: true,
      estado: true,
      indTipoSolicitud: true,
      diasResolucion: true,
      fechaResolucion: true,
    },
  });
  const n = filas.length;

  // ===== 1. Segmentación de municipios (k-means por perfil de tipo) =====
  const tiposTop = topN(
    filas.map((f) => f.tipoSolicitudCodigo).filter(Boolean) as string[],
    8
  );
  const nombreTipo = new Map(filas.filter((f) => f.tipoSolicitudCodigo).map((f) => [f.tipoSolicitudCodigo!, f.tipoSolicitudNombre ?? f.tipoSolicitudCodigo!]));
  const porMunicipio = new Map<string, number[]>();
  const totalMunicipio = new Map<string, number>();
  for (const f of filas) {
    if (!f.municipio) continue;
    if (!porMunicipio.has(f.municipio)) porMunicipio.set(f.municipio, new Array(tiposTop.length + 1).fill(0));
    const v = porMunicipio.get(f.municipio)!;
    const idx = f.tipoSolicitudCodigo ? tiposTop.indexOf(f.tipoSolicitudCodigo) : -1;
    v[idx >= 0 ? idx : tiposTop.length]++;
    totalMunicipio.set(f.municipio, (totalMunicipio.get(f.municipio) ?? 0) + 1);
  }
  const municipiosSignif = [...porMunicipio.entries()].filter(([m]) => (totalMunicipio.get(m) ?? 0) >= 10);
  const matriz = municipiosSignif.map(([m, v]) => {
    const tot = totalMunicipio.get(m)!;
    return v.map((x) => x / tot); // perfil = proporciones
  });
  // perfil global (para describir cada cluster por lo que lo distingue, no por
  // CONCESIONES DE AGUAS que domina en todos)
  const totalGlobal = [...totalMunicipio.values()].reduce((s, x) => s + x, 0);
  const perfilGlobal = new Array(tiposTop.length + 1).fill(0);
  for (const [, v] of porMunicipio) v.forEach((x, i) => (perfilGlobal[i] += x));
  perfilGlobal.forEach((_, i) => (perfilGlobal[i] /= totalGlobal || 1));

  const K = Math.min(4, municipiosSignif.length);
  const asign = kmeans(matriz, K);
  const clusters = Array.from({ length: K }, (_, c) => {
    const miembros = municipiosSignif.filter((_, i) => asign[i] === c);
    const perfil = new Array(tiposTop.length + 1).fill(0);
    miembros.forEach(([mm]) => {
      const v = porMunicipio.get(mm)!;
      const tot = totalMunicipio.get(mm)!;
      v.forEach((x, i) => (perfil[i] += x / tot / miembros.length));
    });
    const tipos = perfil.map((p, i) => ({
      tipo: i < tiposTop.length ? nombreTipo.get(tiposTop[i]) ?? tiposTop[i] : "Otros",
      p,
      lift: perfilGlobal[i] > 0 ? p / perfilGlobal[i] : 1,
    }));
    const dominante = [...tipos].sort((x, y) => y.p - x.p)[0];
    return {
      municipios: miembros.map(([mm]) => mm).sort(),
      total: miembros.reduce((s, [mm]) => s + (totalMunicipio.get(mm) ?? 0), 0),
      dominante,
      distintivos: [...tipos]
        .filter((t) => t.tipo !== dominante.tipo && t.p >= 0.04 && t.lift >= 1.25)
        .sort((x, y) => y.lift - x.lift)
        .slice(0, 3),
    };
  })
    .filter((c) => c.municipios.length > 0)
    .sort((a, b) => b.total - a.total);

  // ===== 2. Meses atípicos (z-score robusto) =====
  const porMes = new Map<string, number>();
  for (const f of filas) {
    if (!f.fechaResolucion) continue;
    const k = `${f.fechaResolucion.getUTCFullYear()}-${String(f.fechaResolucion.getUTCMonth() + 1).padStart(2, "0")}`;
    porMes.set(k, (porMes.get(k) ?? 0) + 1);
  }
  const mesesArr = [...porMes.entries()].sort();
  // solo desde el primer mes con actividad sostenida
  const desde = mesesArr.findIndex((_, i) => mesesArr.slice(i, i + 6).reduce((s, [, c]) => s + c, 0) >= 12);
  const serieMeses = desde >= 0 ? mesesArr.slice(desde) : mesesArr;
  const vals = serieMeses.map(([, c]) => c);
  const med = mediana(vals);
  const mad = mediana(vals.map((v) => Math.abs(v - med))) || 1;
  const anomaliasMes = serieMeses
    .map(([mes, c]) => ({ mes, valor: c, z: (0.6745 * (c - med)) / mad }))
    .filter((x) => Math.abs(x.z) >= 3.5)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
    .slice(0, 8);

  // ===== 3. Tiempos de trámite atípicos (IQR / Tukey) =====
  const dias = filas.map((f) => f.diasResolucion).filter((d): d is number => d != null);
  const q1 = cuantil(dias, 0.25);
  const q3 = cuantil(dias, 0.75);
  const iqr = q3 - q1;
  const vallaAlta = q3 + 1.5 * iqr;
  const atipicosLentos = await db.sincaResolucion.findMany({
    where: { ...filtroFecha, diasResolucion: { gt: Math.round(vallaAlta) } },
    orderBy: { diasResolucion: "desc" },
    take: 8,
    select: { nroSolicitud: true, numeroResolucion: true, diasResolucion: true, tipoSolicitudNombre: true, municipio: true, fechaResolucion: true },
  });
  const pctAtipicos = dias.length ? dias.filter((d) => d > vallaAlta).length / dias.length : 0;

  // ===== 4. Naive Bayes: factores de aprobación =====
  const conEstado = filas.filter((f) => f.estado);
  const aprobadas = conEstado.filter((f) => f.estado === "Aprobada").length;
  const pA = aprobadas / conEstado.length;
  const factores: { factor: string; valor: string; lift: number; casos: number }[] = [];
  const dims: [string, (f: Fila) => string | null][] = [
    ["Tipo de trámite", (f) => (f.tipoSolicitudNombre ? f.tipoSolicitudNombre : null)],
    ["Municipio", (f) => f.municipio],
    ["Modalidad", (f) => f.indTipoSolicitud],
    ["Época", (f) => (f.anioResolucion ? (f.anioResolucion <= 2015 ? "2008–2015" : f.anioResolucion <= 2020 ? "2016–2020" : "2021–2026") : null)],
  ];
  for (const [dim, get] of dims) {
    const grupos = new Map<string, { total: number; aprob: number }>();
    for (const f of conEstado) {
      const v = get(f);
      if (!v) continue;
      const g = grupos.get(v) ?? { total: 0, aprob: 0 };
      g.total++;
      if (f.estado === "Aprobada") g.aprob++;
      grupos.set(v, g);
    }
    for (const [v, g] of grupos) {
      if (g.total < 25) continue;
      const pAdado = g.aprob / g.total;
      const lift = pAdado / pA; // >1 sube la probabilidad de aprobación, <1 la baja
      factores.push({ factor: dim, valor: v, lift, casos: g.total });
    }
  }
  const factoresSuben = [...factores].sort((a, b) => b.lift - a.lift).slice(0, 6);
  const factoresBajan = [...factores].sort((a, b) => a.lift - b.lift).slice(0, 6);

  // ===== 5. Año de quiebre en la actividad (regresión de dos segmentos) =====
  const porAnio = new Map<number, number>();
  for (const f of filas) if (f.anioResolucion) porAnio.set(f.anioResolucion, (porAnio.get(f.anioResolucion) ?? 0) + 1);
  const serieAnio = [...porAnio.entries()].filter(([y]) => y >= 2004 && y <= new Date().getUTCFullYear() - 1).sort((a, b) => a[0] - b[0]);
  let quiebre: { anio: number; pendienteAntes: number; pendienteDespues: number } | null = null;
  if (serieAnio.length >= 10) {
    const ajuste = (pts: [number, number][]): { err: number; b: number } => {
      const nn = pts.length;
      if (nn < 2) return { err: 0, b: 0 };
      const sx = pts.reduce((s, p) => s + p[0], 0);
      const sy = pts.reduce((s, p) => s + p[1], 0);
      const sxx = pts.reduce((s, p) => s + p[0] * p[0], 0);
      const sxy = pts.reduce((s, p) => s + p[0] * p[1], 0);
      const b = (nn * sxy - sx * sy) / (nn * sxx - sx * sx || 1);
      const a = (sy - b * sx) / nn;
      return { err: pts.reduce((s, p) => s + (p[1] - (a + b * p[0])) ** 2, 0), b };
    };
    let mejor = { anio: 0, err: Infinity, b1: 0, b2: 0 };
    for (let i = 4; i < serieAnio.length - 4; i++) {
      const izq = ajuste(serieAnio.slice(0, i + 1) as [number, number][]);
      const der = ajuste(serieAnio.slice(i) as [number, number][]);
      if (izq.err + der.err < mejor.err) mejor = { anio: serieAnio[i][0], err: izq.err + der.err, b1: izq.b, b2: der.b };
    }
    if (mejor.anio) quiebre = { anio: mejor.anio, pendienteAntes: mejor.b1, pendienteDespues: mejor.b2 };
  }

  return {
    n,
    clusters: { grupos: clusters, tiposTop: tiposTop.map((t) => nombreTipo.get(t) ?? t), municipiosAnalizados: municipiosSignif.length },
    anomaliasMes,
    tiemposAtipicos: {
      vallaAlta: Math.round(vallaAlta),
      q1: Math.round(q1),
      q3: Math.round(q3),
      pct: pctAtipicos,
      casos: atipicosLentos.map((r) => ({
        nroSolicitud: r.nroSolicitud,
        numeroResolucion: r.numeroResolucion,
        dias: r.diasResolucion,
        tipo: r.tipoSolicitudNombre,
        municipio: r.municipio,
        anio: r.fechaResolucion?.getUTCFullYear() ?? null,
      })),
    },
    aprobacion: { base: pA, suben: factoresSuben, bajan: factoresBajan },
    quiebre,
  };
}

function topN(xs: string[], k: number): string[] {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([v]) => v);
}

export const getMineria = unstable_cache(calcularMineria, ["sinca-mineria"], {
  revalidate: 3600,
  tags: ["sinca-analitica"],
});
