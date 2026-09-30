import Link from "next/link";
import { Sparkles, FolderOpen, Clock3, CheckCircle2, Timer, Download } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederTramite } from "@/lib/permisos";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { SelectorPeriodo } from "@/components/SelectorPeriodo";
import { SelectorTramites } from "@/components/SelectorTramites";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { calcularMineriaTramites, filasDeDimension, DIMENSIONES_TABLA, type DimensionTabla } from "@/lib/tramites-mineria";

const num = (v: number) => v.toLocaleString("es-CO");
const DIMENSIONES = Object.keys(DIMENSIONES_TABLA) as DimensionTabla[];

export default async function MineriaTramitesPage({
  searchParams,
}: {
  searchParams: Promise<FiltrosPeriodo & { tramite?: string; agrupar?: string }>;
}) {
  const sp = await searchParams;
  const { rango, etiqueta } = resolverPeriodo(sp);
  const session = await getSession();
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  const tramiteIdsPermitidos = permisos && !permisos.esAdmin ? Array.from(permisos.tramites.keys()) : null;
  const tramites = sp.tramite?.split(",").filter(Boolean);
  const dimension: DimensionTabla = DIMENSIONES.includes(sp.agrupar as DimensionTabla) ? (sp.agrupar as DimensionTabla) : "tipo";

  const [m, todosLosTramites] = await Promise.all([
    calcularMineriaTramites({ tramiteIdsPermitidos, rango, tramites }),
    db.tramiteTipo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);
  const opcionesTramite = (permisos ? todosLosTramites.filter((t) => puedeAccederTramite(permisos, t.id)) : todosLosTramites).map((t) => ({
    valor: t.id,
    etiqueta: t.nombre,
  }));

  const hrefAgrupar = (dim: DimensionTabla) => {
    const params = new URLSearchParams();
    if (sp.desde) params.set("desde", sp.desde);
    if (sp.hasta) params.set("hasta", sp.hasta);
    if (sp.tramite) params.set("tramite", sp.tramite);
    params.set("agrupar", dim);
    return `/mineria?${params.toString()}`;
  };
  const hrefExportar = () => {
    const params = new URLSearchParams();
    if (sp.desde) params.set("desde", sp.desde);
    if (sp.hasta) params.set("hasta", sp.hasta);
    if (sp.tramite) params.set("tramite", sp.tramite);
    params.set("agrupar", dimension);
    return `/api/tramites/mineria/exportar?${params.toString()}`;
  };

  const filasTabla = filasDeDimension(m, dimension);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <Sparkles className="h-4 w-4 text-cdmb-600" aria-hidden />
          Minería de datos — Trámites ambientales 2.0
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Indicadores y agregaciones sobre {num(m.total)} expediente{m.total === 1 ? "" : "s"}
          {rango ? ` radicados entre ${etiqueta}.` : "."} Combine el período y uno o varios trámites para acotar el análisis.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SelectorPeriodo desdeActual={sp.desde} hastaActual={sp.hasta} />
        <SelectorTramites opciones={opcionesTramite} titulo="Trámites" />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Kpi icon={FolderOpen} label="Total" value={num(m.total)} />
        <Kpi icon={Clock3} label="En proceso" value={num(m.enProceso)} />
        <Kpi icon={CheckCircle2} label="Finalizados" value={num(m.finalizados)} />
      </div>

      <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        <h3 className="text-sm font-semibold text-stone-900">Evolución mensual</h3>
        <p className="mb-2 text-xs text-stone-500">{rango ? etiqueta : "Últimos 24 meses"}, por fecha de radicación.</p>
        <AreaTrendChart data={m.porMes.map((f) => ({ label: f.label, value: f.total }))} emptyMessage="Sin datos mensuales." />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
          <h3 className="text-sm font-semibold text-stone-900">Por tipo de trámite</h3>
          <p className="mb-3 text-xs text-stone-500">Cuántos expedientes hay de cada trámite.</p>
          <BarChartHorizontal data={m.porTipo.map((f) => ({ label: f.label, value: f.total }))} emptyMessage="Sin datos." />
        </section>
        <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
          <h3 className="text-sm font-semibold text-stone-900">Por estado</h3>
          <p className="mb-3 text-xs text-stone-500">Distribución por estado del expediente.</p>
          <BarChartHorizontal data={m.porEstado.map((f) => ({ label: f.label, value: f.total }))} emptyMessage="Sin datos." />
        </section>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        <h3 className="text-sm font-semibold text-stone-900">Por municipio</h3>
        <p className="mb-3 text-xs text-stone-500">Los 15 municipios con más expedientes.</p>
        <BarChartHorizontal data={m.porMunicipio.map((f) => ({ label: f.label, value: f.total }))} emptyMessage="Sin datos." />
      </section>

      {m.tiempoPromedioPorTipo.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
            <Timer className="h-4 w-4 text-cdmb-600" aria-hidden />
            Tiempo promedio de respuesta por tipo
          </h3>
          <p className="mb-3 text-xs text-stone-500">
            De la radicación a la resolución (aprobado, negado, desistido, archivado o rechazado). Solo trámites con al menos un caso finalizado.
          </p>
          <ul className="divide-y divide-stone-100 text-sm">
            {m.tiempoPromedioPorTipo.map((t) => (
              <li key={t.tramiteTipoId} className="flex items-baseline justify-between py-1.5">
                <span className="truncate text-stone-700">
                  {t.tramite} <span className="text-stone-400">({t.codigo})</span>
                </span>
                <span className="flex-none tabular-nums text-stone-600">
                  {t.diasPromedio != null ? `${t.diasPromedio} d` : "—"} <span className="text-xs text-stone-400">n={t.n}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Tabla dinámica</h3>
            <p className="text-xs text-stone-500">Agrupe por cualquier dimensión y exporte el resultado a Excel.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {DIMENSIONES.map((dim) => (
              <Link
                key={dim}
                prefetch={false}
                href={hrefAgrupar(dim)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${dim === dimension ? "bg-cdmb-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
              >
                {DIMENSIONES_TABLA[dim].etiqueta}
              </Link>
            ))}
            {filasTabla.length > 0 && (
              <a
                href={hrefExportar()}
                className="ml-1 flex items-center gap-1 rounded-lg border border-cdmb-600 px-3 py-1.5 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Exportar
              </a>
            )}
          </div>
        </div>
        {filasTabla.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-stone-400">Sin datos para esta agrupación.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">{DIMENSIONES_TABLA[dimension].columna}</th>
                <th className="px-4 py-2 text-right font-medium">Cantidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filasTabla.map((f) => (
                <tr key={f.valor}>
                  <td className="px-4 py-2 text-stone-800">{f.label}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums text-stone-800">{num(f.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof FolderOpen; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-soft p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-stone-500">
        <Icon className="h-3.5 w-3.5 text-stone-400" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums leading-tight text-stone-900">{value}</p>
    </div>
  );
}
