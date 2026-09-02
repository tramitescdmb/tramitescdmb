import Link from "next/link";
import { redirect } from "next/navigation";
import { FileCheck2, Stamp, CalendarClock, RefreshCw, Timer, Scale, Sparkles, Hash } from "lucide-react";
import { getSession } from "@/lib/auth";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";
import { sincaConfigurado } from "@/lib/sinca";
import { getHistoricoDashboard } from "@/lib/sinca-data";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { AreaAnual } from "@/components/charts/AreaAnual";

const fecha = (d: Date | null) => (d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const fechaHora = (d: Date | null | undefined) =>
  d ? d.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const num = (v: number) => v.toLocaleString("es-CO");

export default async function HistoricoPanelPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const session = await getSession();
  if (session) {
    const permisos = await obtenerPermisosUsuario(session.userId);
    if (!puedeAccederSeccion(permisos, "SINCA_DASHBOARD")) redirect("/");
  }
  const esAdmin = session?.rol === "ADMIN";

  if (!sincaConfigurado()) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
        La conexión con SINCA 1.0 no está configurada en este servidor (variables <code>SINCA_API_URL</code>, <code>SINCA_API_USUARIO</code>, <code>SINCA_API_PASSWORD</code>).
      </div>
    );
  }

  const d = await getHistoricoDashboard();
  const sinDatos = d.total === 0;

  const botonSync = esAdmin ? (
    <form action="/api/sinca/sincronizar" method="post">
      <button className="flex items-center gap-1.5 rounded-md border border-cdmb-600 bg-white px-3 py-1.5 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Sincronizar ahora
      </button>
    </form>
  ) : null;

  return (
    <div className="space-y-4">
      {ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</div>}
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {sinDatos ? (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-sm text-stone-600">
            Todavía no se ha traído el histórico de SINCA 1.0.
            {esAdmin ? " Use el botón para hacer la primera carga." : " Un administrador debe hacer la primera carga."}
          </p>
          {esAdmin && <div className="mt-4 flex justify-center">{botonSync}</div>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi icon={FileCheck2} label="Solicitudes" value={num(d.total)} />
            <Kpi icon={Scale} label="Trámites aprobados" value={num(d.aprobadas)} />
            <Kpi icon={Stamp} label="Tasa de aprobación" value={`${(d.tasaAprobacion * 100).toFixed(1)} %`} />
            <Kpi
              icon={Timer}
              label="Tiempo mediano"
              value={d.diasResolucionP50 != null ? `${d.diasResolucionP50} d` : "…"}
              hint={d.diasResolucionP50 != null ? "de radicación a resolución" : "en cálculo"}
            />
            <Kpi
              icon={CalendarClock}
              label="Años"
              value={d.serieAnual.length ? `${d.serieAnual[0].label}–${d.serieAnual[d.serieAnual.length - 1].label}` : "—"}
            />
            <Kpi icon={Hash} label="Con N.º de resolución" value={num(d.conResolucion)} />
          </div>

          <Link
            href="/historico/mineria"
            className="flex items-center justify-between gap-3 rounded-xl border border-cdmb-200 bg-cdmb-50 px-4 py-2.5 text-sm transition-colors hover:bg-cdmb-100"
          >
            <span className="flex items-center gap-2 font-medium text-cdmb-900">
              <Sparkles className="h-4 w-4" aria-hidden />
              Minería de datos — pronóstico, ML, KDD, estacionalidad, anomalías, minería de texto
            </span>
            <span className="flex-none font-medium text-cdmb-700" aria-hidden>→</span>
          </Link>

          <section className="rounded-xl border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-stone-900">Solicitudes por año</h2>
            <p className="mb-2 text-xs text-stone-500">Por fecha de la resolución de fondo. Pase el mouse para ver cualquier año.</p>
            <AreaAnual data={d.serieAnual.map((s) => ({ anio: Number(s.label), valor: s.value }))} emptyMessage="Sin datos por año." />
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel titulo="Por tipo de trámite" sub="Los 10 tipos con más resoluciones.">
              <BarChartHorizontal data={d.porTipo} emptyMessage="Sin datos." />
            </Panel>
            <Panel titulo="Por municipio" sub="Los 10 municipios con más resoluciones.">
              <BarChartHorizontal data={d.porMunicipio} emptyMessage="Sin datos." />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel titulo="Por estado" sub="Casi todas aprobadas; el resto negadas, desistidas o sin permiso requerido.">
              <BarChartHorizontal data={d.porEstado} emptyMessage="Sin datos." />
            </Panel>
            <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
                <h2 className="text-sm font-semibold text-stone-900">Últimas resoluciones</h2>
                <Link href="/historico/solicitudes" className="text-xs font-medium text-cdmb-700 hover:underline">
                  Ver todas →
                </Link>
              </div>
              <ul className="divide-y divide-stone-100">
                {d.recientes.map((r) => (
                  <li key={r.nroSolicitud}>
                    <Link href={`/historico/solicitudes/${r.nroSolicitud}`} className="block px-4 py-2 hover:bg-stone-50">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium text-stone-800">
                          Res. {r.numeroResolucion ?? "—"}
                          <span className="ml-1.5 font-normal text-stone-400">Sol. {r.nroSolicitud}</span>
                        </span>
                        <span className="flex-none text-xs text-stone-500">{fecha(r.fechaResolucion)}</span>
                      </div>
                      <p className="truncate text-xs text-stone-500">
                        {r.tipoSolicitudNombre ?? "—"} · {r.municipio ?? "—"}
                        {r.expediente ? ` · ${r.expediente}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-xs text-stone-500">
            <span>
              Última actualización:{" "}
              <span className="font-medium text-stone-700">{fechaHora(d.ultimaSync?.terminadoEn ?? d.ultimaSync?.iniciadoEn)}</span>
              {d.ultimaSync && !d.ultimaSync.ok && <span className="ml-1.5 text-red-600">(falló)</span>}
              {d.ultimaSync?.disparadoPor === "cron" ? " · automática" : d.ultimaSync?.disparadoPor?.startsWith("manual") ? " · manual" : ""}
              {d.sinFechaValida > 0 && ` · ${num(d.sinFechaValida)} con fecha ilegible en el origen`}
            </span>
            {botonSync}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Scale; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-stone-500">
        <Icon className="h-3.5 w-3.5 text-stone-400" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums leading-tight text-stone-900">{value}</p>
      {hint && <p className="text-[10px] text-stone-400">{hint}</p>}
    </div>
  );
}

function Panel({ titulo, sub, children }: { titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-stone-900">{titulo}</h2>
      <p className="mb-3 text-xs text-stone-500">{sub}</p>
      {children}
    </section>
  );
}
