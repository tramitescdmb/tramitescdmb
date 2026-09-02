import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, Timer, Scale, MapPinned, Sparkles, Boxes, AlertTriangle, GitBranch, Brain } from "lucide-react";
import { getSession } from "@/lib/auth";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";
import { getAnalitica } from "@/lib/sinca-analitica";
import { getMineria } from "@/lib/sinca-mineria";
import { sincaConfigurado } from "@/lib/sinca";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { ForecastChart } from "@/components/charts/ForecastChart";
import { HeatmapMesAnio } from "@/components/charts/HeatmapMesAnio";
import { BarrasConIC } from "@/components/charts/BarrasConIC";
import { BarrasLift } from "@/components/charts/BarrasLift";
import { MiniColumnas } from "@/components/charts/MiniColumnas";
import { PipelineKDD } from "@/components/PipelineKDD";

const pct = (v: number) => `${(v * 100).toFixed(1)} %`;
const pctSigno = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)} %`);
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mesLegible = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${MESES[Number(m) - 1]} ${y}`;
};

function Card({ icon: Icon, titulo, sub, children, span }: { icon: typeof Scale; titulo: string; sub?: string; children: ReactNode; span?: boolean }) {
  return (
    <section className={`rounded-xl border border-stone-200 bg-white p-4 ${span ? "lg:col-span-2" : ""}`}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
        <Icon className="h-4 w-4 text-cdmb-600" aria-hidden />
        {titulo}
      </h3>
      {sub && <p className="mb-3 mt-0.5 text-xs text-stone-500">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </section>
  );
}

export default async function MineriaPage() {
  const session = await getSession();
  if (session) {
    const permisos = await obtenerPermisosUsuario(session.userId);
    if (!puedeAccederSeccion(permisos, "SINCA_MINERIA")) redirect("/");
  }
  if (!sincaConfigurado()) {
    return <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">SINCA 1.0 no está configurado en este servidor.</p>;
  }

  const [a, m] = await Promise.all([getAnalitica(), getMineria()]);
  if (a.total === 0) {
    return <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">Aún no se ha cargado el histórico. Sincronice desde el panel.</p>;
  }

  const g = a.pronostico;

  return (
    <div className="space-y-4">
      {/* Encabezado + proceso KDD */}
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <Sparkles className="h-4 w-4 text-cdmb-600" aria-hidden />
          Minería de datos y descubrimiento de conocimiento (KDD)
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Inferencia estadística y aprendizaje automático sobre las {a.total.toLocaleString("es-CO")} resoluciones de fondo del
          histórico. Los algoritmos corren en el servidor y están implementados sin librerías externas para que sean auditables.
        </p>
        <div className="mt-3">
          <PipelineKDD />
        </div>
        {a.coberturaDias < 0.9 && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
            El tiempo de trámite se calcula sobre el {pct(a.coberturaDias)} de los registros; el resto se completa con la
            sincronización diaria.
          </p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={Scale} label="Tasa de aprobación" valor={pct(a.aprobacion.p)} sub={`IC 95 %: ${pct(a.aprobacion.lo)}–${pct(a.aprobacion.hi)}`} />
        <Kpi icon={Timer} label="Tiempo de resolución (mediana)" valor={a.diasP50 != null ? `${a.diasP50} d` : "—"} sub={a.diasP90 != null ? `p90 ≤ ${a.diasP90} d` : "en cálculo…"} />
        <Kpi icon={TrendingUp} label="Volumen últimos 12 meses" valor={a.volumen.ult12.toLocaleString("es-CO")} sub={`${pctSigno(a.volumen.cambio12)} vs. 12 meses previos`} />
        <Kpi icon={MapPinned} label="Concentración (top 5 municipios)" valor={pct(a.concentracion.top5)} sub={`HHI ${a.concentracion.hhi.toFixed(2)}`} />
      </div>

      {/* Pronóstico */}
      {g && (
        <Card
          icon={TrendingUp}
          titulo="Proyección de resoluciones por año"
          sub={`Regresión lineal sobre años completos (R² = ${g.r2.toFixed(2)}). Banda = intervalo de predicción del 95 %.`}
        >
          <ForecastChart historico={g.historico} proyeccion={g.proyeccion} emptyMessage="Sin suficientes años." />
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-500">
            {g.proyeccion.map((p) => (
              <span key={p.anio}>
                <strong className="text-stone-700">{p.anio}:</strong> ~{p.valor.toLocaleString("es-CO")} ({p.lo.toLocaleString("es-CO")}–{p.hi.toLocaleString("es-CO")})
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Punto de quiebre */}
      {m.quiebre && (
        <Card icon={GitBranch} titulo="Cambio de régimen en la actividad" sub="Regresión de dos segmentos: el año que mejor parte la serie en dos tendencias distintas.">
          <p className="text-sm text-stone-700">
            La actividad {m.quiebre.pendienteAntes >= 0 ? "creció" : "bajó"} a un ritmo de{" "}
            <strong>{Math.abs(Math.round(m.quiebre.pendienteAntes))} resoluciones/año</strong> hasta{" "}
            <strong>{m.quiebre.anio}</strong>, y desde entonces{" "}
            {m.quiebre.pendienteDespues >= 0 ? "sigue creciendo" : "decrece o se vuelve volátil"} a{" "}
            <strong>{Math.round(m.quiebre.pendienteDespues) >= 0 ? "+" : ""}{Math.round(m.quiebre.pendienteDespues)} por año</strong>.
          </p>
        </Card>
      )}

      {/* Estacionalidad */}
      <Card icon={Sparkles} titulo="Estacionalidad — resoluciones por mes y año" sub="El tono indica cuántas resoluciones se firmaron ese mes. Revela si la CDMB concentra decisiones en ciertas épocas.">
        <HeatmapMesAnio filas={a.heatmap} emptyMessage="Sin datos mensuales." />
        <p className="mb-2 mt-4 text-xs font-medium text-stone-600">Índice estacional (1,0 = mes promedio)</p>
        <MiniColumnas
          data={a.indiceEstacional.map((mm) => ({ label: MESES[mm.mes - 1], valor: mm.indice }))}
          referencia={1}
          formato={(v) => `${v.toFixed(2)}×`}
        />
      </Card>

      {/* ML: segmentación de municipios */}
      <Card
        icon={Boxes}
        titulo="Segmentación de municipios (k-means)"
        sub={`Agrupa los ${m.clusters.municipiosAnalizados} municipios con ≥ 10 resoluciones según su mezcla de tipos de trámite. Perfiles descubiertos, no definidos a mano.`}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {m.clusters.grupos.map((c, i) => (
            <div key={i} className="rounded-lg border border-stone-200 p-3">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold text-stone-800">Grupo {i + 1}</p>
                <span className="text-xs text-stone-400">{c.total.toLocaleString("es-CO")} resoluciones</span>
              </div>
              <p className="mt-0.5 text-xs text-stone-600">
                Predomina {c.dominante.tipo} ({(c.dominante.p * 100).toFixed(0)} %)
              </p>
              {c.distintivos.length > 0 && (
                <p className="mt-0.5 text-xs text-cdmb-700">
                  Sobre-representa: {c.distintivos.map((d) => `${d.tipo} (${d.lift.toFixed(1)}×)`).join(", ")}
                </p>
              )}
              <p className="mt-1.5 text-xs text-stone-500">{c.municipios.join(", ")}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ML: Naive Bayes aprobación */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card icon={Brain} titulo="Qué sube la probabilidad de aprobación" sub={`Naive Bayes · razón de verosimilitud (lift) frente a la tasa base de ${pct(m.aprobacion.base)}.`}>
          <BarrasLift data={m.aprobacion.suben.map((f) => ({ label: `${f.valor} · ${f.factor}`, lift: f.lift, casos: f.casos }))} emptyMessage="—" />
        </Card>
        <Card icon={Brain} titulo="Qué la baja" sub="Los mismos factores, ordenados por el que más reduce la probabilidad de aprobación.">
          <BarrasLift data={m.aprobacion.bajan.map((f) => ({ label: `${f.valor} · ${f.factor}`, lift: f.lift, casos: f.casos }))} emptyMessage="—" />
        </Card>
      </div>

      {/* ML: anomalías */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card icon={AlertTriangle} titulo="Meses atípicos" sub="Desviación robusta (mediana / MAD). Se marcan los meses con |z| ≥ 3,5 — picos o caídas que no son ruido normal.">
          {m.anomaliasMes.length === 0 ? (
            <p className="text-sm text-stone-500">Sin meses atípicos.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {m.anomaliasMes.map((x) => (
                <li key={x.mes} className="flex items-baseline justify-between py-1.5">
                  <span className="text-stone-700">{mesLegible(x.mes)}</span>
                  <span className="tabular-nums text-stone-500">
                    {x.valor} <span className={x.z > 0 ? "text-cdmb-700" : "text-orange-600"}>({x.z > 0 ? "+" : ""}{x.z.toFixed(1)} σ)</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card icon={AlertTriangle} titulo="Trámites con tiempo atípico" sub={`Vallas de Tukey: por encima de ${m.tiemposAtipicos.vallaAlta.toLocaleString("es-CO")} días (Q3 + 1,5·RIC). Son el ${pct(m.tiemposAtipicos.pct)} de los casos.`}>
          {m.tiemposAtipicos.casos.length === 0 ? (
            <p className="text-sm text-stone-500">Sin casos atípicos.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {m.tiemposAtipicos.casos.map((c) => (
                <li key={c.nroSolicitud} className="py-1.5">
                  <Link href={`/historico/solicitudes/${c.nroSolicitud}`} className="flex items-baseline justify-between hover:underline">
                    <span className="truncate text-stone-700">
                      Res. {c.numeroResolucion ?? "—"} <span className="text-stone-400">· {c.municipio ?? "—"} · {c.anio ?? "—"}</span>
                    </span>
                    <span className="flex-none tabular-nums font-medium text-orange-700">{c.dias?.toLocaleString("es-CO")} d</span>
                  </Link>
                  <p className="truncate text-xs text-stone-400">{c.tipo}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Tiempo de resolución */}
      {a.histogramaDias.length > 0 && (
        <Card icon={Timer} titulo="¿Cuánto tarda un trámite en tener resolución de fondo?" sub={`De la radicación a la resolución. Sobre ${a.enriquecidas.toLocaleString("es-CO")} resoluciones.`}>
          <BarChartHorizontal data={a.histogramaDias} emptyMessage="—" />
          <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-medium text-stone-600">Mediana de días por año de resolución</p>
              <AreaTrendChart data={a.diasPorAnio.filter((x) => x.n >= 5).map((x) => ({ label: String(x.anio), value: x.p50 }))} emptyMessage="—" />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-stone-600">Mediana de días por tipo de trámite</p>
              <BarChartHorizontal data={a.diasPorTipo.map((x) => ({ label: x.label, value: x.value }))} emptyMessage="—" formatValue={(v) => `${v} d`} />
            </div>
          </div>
        </Card>
      )}

      {/* Fricción + Pareto */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card icon={AlertTriangle} titulo="Fricción por tipo de trámite" sub="% de resoluciones que NO terminaron aprobadas. El bigote es el IC 95 %: ancho = pocos casos.">
          <BarrasConIC
            data={a.friccionPorTipo.map((f) => ({ label: f.tipo, valor: f.pct, lo: f.lo, hi: f.hi, nota: `n=${f.total}` }))}
            emptyMessage="—"
          />
        </Card>
        <Card
          icon={MapPinned}
          titulo="Concentración territorial (Pareto)"
          sub={m.n && a.municipios80 > 0 ? `${a.municipios80} de ${a.concentracion.municipios} municipios concentran el 80 %.` : "Resoluciones por municipio."}
        >
          <BarChartHorizontal data={a.pareto.slice(0, 12).map((p) => ({ label: `${p.municipio} · ${pct(p.acumPct)} acum.`, value: p.valor }))} emptyMessage="—" />
        </Card>
      </div>

      {/* Recurrentes */}
      {a.recurrentes.length > 0 && (
        <Card icon={Boxes} titulo="Solicitantes recurrentes" sub={`Quiénes tramitan más ante la CDMB (por NIT/cédula, sobre ${pct(a.coberturaNit)} de los registros).`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="pb-1.5 font-medium">Interesado</th>
                  <th className="pb-1.5 font-medium">NIT / cédula</th>
                  <th className="pb-1.5 text-right font-medium">Resoluciones</th>
                  <th className="pb-1.5 text-right font-medium">Años</th>
                  <th className="pb-1.5 text-right font-medium">Tipos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {a.recurrentes.map((r) => (
                  <tr key={r.nit}>
                    <td className="py-1.5 text-stone-800">{r.nombre ?? "—"}</td>
                    <td className="py-1.5 text-stone-500">{r.nit}</td>
                    <td className="py-1.5 text-right font-medium tabular-nums text-stone-800">{r.total}</td>
                    <td className="py-1.5 text-right tabular-nums text-stone-500">{r.anios}</td>
                    <td className="py-1.5 text-right tabular-nums text-stone-500">{r.tipos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Minería de texto */}
      <Card icon={Brain} titulo="Minería de texto de las descripciones de proyecto" sub={`Términos y frases más frecuentes en el campo libre "proyecto", quitando palabras vacías.`}>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-medium text-stone-600">Términos</p>
            <BarChartHorizontal data={a.mineriaTexto.terminos.slice(0, 18)} emptyMessage="—" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-stone-600">Frases (bigramas)</p>
            <ul className="space-y-1 text-sm">
              {a.mineriaTexto.frases.map((f) => (
                <li key={f.label} className="flex items-baseline justify-between gap-2 border-b border-stone-100 pb-1">
                  <span className="truncate text-stone-700">{f.label}</span>
                  <span className="flex-none tabular-nums text-stone-400">{f.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, valor, sub }: { icon: typeof Scale; label: string; valor: string; sub: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-stone-500">
        <Icon className="h-3.5 w-3.5 text-stone-400" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums leading-tight text-stone-900">{valor}</p>
      <p className="text-[10px] text-stone-400">{sub}</p>
    </div>
  );
}
