import { TrendingUp, Timer, Scale, MapPinned, Sparkles } from "lucide-react";
import { getAnalitica } from "@/lib/sinca-analitica";
import { sincaConfigurado } from "@/lib/sinca";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { ForecastChart } from "@/components/charts/ForecastChart";
import { HeatmapMesAnio } from "@/components/charts/HeatmapMesAnio";
import { BarrasConIC } from "@/components/charts/BarrasConIC";

const pct = (v: number) => `${(v * 100).toFixed(1)} %`;
const pctSigno = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)} %`);
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default async function AnalisisPage() {
  if (!sincaConfigurado()) {
    return <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">SINCA 1.0 no está configurado en este servidor.</p>;
  }

  const a = await getAnalitica();
  if (a.total === 0) {
    return <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">Aún no se ha cargado el histórico. Sincronice desde el panel.</p>;
  }

  const g = a.pronostico;
  const tendenciaTxt =
    g && g.pendiente > 3
      ? `crece a un ritmo de ${Math.round(g.pendiente)} resoluciones más por año`
      : g && g.pendiente < -3
        ? `decrece unas ${Math.abs(Math.round(g.pendiente))} resoluciones por año`
        : "se mantiene estable año a año";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <Sparkles className="h-4 w-4 text-cdmb-600" aria-hidden />
          Análisis y minería de datos
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Inferencia estadística sobre las {a.total.toLocaleString("es-CO")} resoluciones de fondo del histórico.
          {a.coberturaDias < 0.9 && (
            <>
              {" "}El tiempo de trámite se calcula sobre el {pct(a.coberturaDias)} de los registros
              ({a.enriquecidas.toLocaleString("es-CO")} con fecha de radicación); el resto se completa con la
              sincronización diaria.
            </>
          )}
        </p>
      </div>

      {/* KPIs con inferencia */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Scale}
          label="Tasa de aprobación"
          valor={pct(a.aprobacion.p)}
          sub={`IC 95 %: ${pct(a.aprobacion.lo)} – ${pct(a.aprobacion.hi)}`}
        />
        <Kpi
          icon={Timer}
          label="Tiempo de resolución (mediana)"
          valor={a.diasP50 != null ? `${a.diasP50} días` : "—"}
          sub={a.diasP90 != null ? `9 de cada 10 en ≤ ${a.diasP90} días` : "en cálculo…"}
        />
        <Kpi
          icon={TrendingUp}
          label="Volumen últimos 12 meses"
          valor={a.volumen.ult12.toLocaleString("es-CO")}
          sub={`${pctSigno(a.volumen.cambio12)} vs. los 12 meses previos (${a.volumen.prev12.toLocaleString("es-CO")})`}
        />
        <Kpi
          icon={MapPinned}
          label="Concentración geográfica"
          valor={pct(a.concentracion.top5)}
          sub={`en los 5 municipios más frecuentes · HHI ${a.concentracion.hhi.toFixed(2)}`}
        />
      </div>

      {/* Pronóstico */}
      {g && (
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-stone-900">Proyección de resoluciones por año</h3>
          <p className="mb-4 text-xs text-stone-500">
            Regresión lineal sobre los años completos (R² = {g.r2.toFixed(2)}). La serie {tendenciaTxt}. La banda es el
            intervalo de predicción del 95 %: el valor real de un año nuevo debería caer ahí salvo un cambio de fondo.
          </p>
          <ForecastChart historico={g.historico} proyeccion={g.proyeccion} emptyMessage="Sin suficientes años para proyectar." />
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-stone-500">
            {g.proyeccion.map((p) => (
              <span key={p.anio}>
                <strong className="text-stone-700">{p.anio}:</strong> ~{p.valor.toLocaleString("es-CO")} ({p.lo.toLocaleString("es-CO")}–{p.hi.toLocaleString("es-CO")})
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Estacionalidad */}
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-stone-900">Estacionalidad — resoluciones por mes y año</h3>
        <p className="mb-4 text-xs text-stone-500">
          Cada celda es un mes; el tono indica cuántas resoluciones se firmaron. Sirve para ver si la CDMB concentra las
          decisiones en ciertas épocas del año.
        </p>
        <HeatmapMesAnio filas={a.heatmap} emptyMessage="Sin datos mensuales." />
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-stone-600">Índice estacional (1,0 = mes promedio)</p>
          <BarChartHorizontal
            data={a.indiceEstacional.map((m) => ({ label: MESES[m.mes - 1], value: Math.round(m.indice * 100) }))}
            emptyMessage="—"
            formatValue={(v) => `${(v / 100).toFixed(2)}×`}
          />
        </div>
      </section>

      {/* Tiempo de resolución */}
      {a.histogramaDias.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-stone-900">¿Cuánto tarda un trámite en tener resolución de fondo?</h3>
          <p className="mb-4 text-xs text-stone-500">
            Desde la fecha de radicación hasta la fecha de la resolución. Sobre {a.enriquecidas.toLocaleString("es-CO")} resoluciones.
          </p>
          <BarChartHorizontal data={a.histogramaDias} emptyMessage="—" />

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-stone-600">Mediana de días por año de resolución</p>
              <AreaTrendChart
                data={a.diasPorAnio.filter((d) => d.n >= 5).map((d) => ({ label: String(d.anio), value: d.p50 }))}
                emptyMessage="—"
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-stone-600">Mediana de días por tipo de trámite</p>
              <BarChartHorizontal
                data={a.diasPorTipo.map((d) => ({ label: d.label, value: d.value }))}
                emptyMessage="—"
                formatValue={(v) => `${v} días`}
              />
            </div>
          </div>
        </section>
      )}

      {/* Fricción por tipo */}
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-stone-900">Fricción por tipo de trámite</h3>
        <p className="mb-4 text-xs text-stone-500">
          Porcentaje de resoluciones que <strong>no</strong> terminaron aprobadas (negadas, desistidas, en estudio). El
          bigote es el intervalo de confianza del 95 %: donde es ancho, hay pocos casos y el dato es menos firme.
        </p>
        <BarrasConIC
          data={a.friccionPorTipo.map((f) => ({
            label: f.tipo,
            valor: f.pct,
            lo: f.lo,
            hi: f.hi,
            nota: `n=${f.total}`,
          }))}
          emptyMessage="—"
        />
      </section>

      {/* Concentración / Pareto */}
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-stone-900">Concentración territorial (Pareto)</h3>
        <p className="mb-4 text-xs text-stone-500">
          {a.municipios80 > 0 ? (
            <>
              <strong>{a.municipios80}</strong> de los {a.concentracion.municipios} municipios concentran el 80 % de las
              resoluciones históricas.
            </>
          ) : (
            "Distribución de resoluciones por municipio."
          )}
        </p>
        <BarChartHorizontal
          data={a.pareto.slice(0, 12).map((p) => ({ label: `${p.municipio} · ${pct(p.acumPct)} acum.`, value: p.valor }))}
          emptyMessage="—"
        />
      </section>

      {/* Solicitantes recurrentes */}
      {a.recurrentes.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-stone-900">Solicitantes recurrentes</h3>
            <p className="text-xs text-stone-500">
              Quiénes tramitan más ante la CDMB (por NIT/cédula del interesado, sobre {pct(a.coberturaNit)} de los registros).
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-5 py-2 font-medium">Interesado</th>
                <th className="px-4 py-2 font-medium">NIT / cédula</th>
                <th className="px-4 py-2 font-medium text-right">Resoluciones</th>
                <th className="px-4 py-2 font-medium text-right">Años activos</th>
                <th className="px-4 py-2 font-medium text-right">Tipos de trámite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {a.recurrentes.map((r) => (
                <tr key={r.nit}>
                  <td className="px-5 py-2 text-stone-800">{r.nombre ?? "—"}</td>
                  <td className="px-4 py-2 text-stone-500">{r.nit}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums text-stone-800">{r.total}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500">{r.anios}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500">{r.tipos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Minería de texto */}
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-stone-900">Minería de texto de las descripciones de proyecto</h3>
        <p className="mb-4 text-xs text-stone-500">
          Términos y frases más frecuentes en el campo libre &ldquo;proyecto&rdquo; de las {a.total.toLocaleString("es-CO")} resoluciones,
          quitando palabras vacías. Muestra de qué tratan realmente los trámites.
        </p>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-stone-600">Términos</p>
            <BarChartHorizontal data={a.mineriaTexto.terminos.slice(0, 20)} emptyMessage="—" />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-stone-600">Frases (bigramas)</p>
            <ul className="space-y-1.5 text-sm">
              {a.mineriaTexto.frases.map((f) => (
                <li key={f.label} className="flex items-baseline justify-between gap-2 border-b border-stone-100 pb-1">
                  <span className="text-stone-700">{f.label}</span>
                  <span className="tabular-nums text-stone-400">{f.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  valor,
  sub,
}: {
  icon: typeof Scale;
  label: string;
  valor: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2 text-stone-400">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="text-xs font-medium text-stone-500">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-stone-900">{valor}</p>
      <p className="mt-1 text-xs text-stone-400">{sub}</p>
    </div>
  );
}
