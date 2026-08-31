import Link from "next/link";
import { FileCheck2, Stamp, CalendarClock, RefreshCw } from "lucide-react";
import { getSession } from "@/lib/auth";
import { sincaConfigurado } from "@/lib/sinca";
import { getHistoricoDashboard } from "@/lib/sinca-data";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";

function fecha(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}
function fechaHora(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function HistoricoPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const session = await getSession();
  const esAdmin = session?.rol === "ADMIN";

  if (!sincaConfigurado()) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
        <p className="text-sm text-stone-600">
          La conexión con SINCA 1.0 no está configurada en este servidor. El administrador del sistema
          debe definir las variables <code>SINCA_API_URL</code>, <code>SINCA_API_USUARIO</code> y{" "}
          <code>SINCA_API_PASSWORD</code>.
        </p>
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
    <div className="space-y-8">
      {ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</div>}
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {sinDatos ? (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-sm text-stone-600">
            Todavía no se ha traído el histórico de SINCA 1.0.
            {esAdmin ? " Use el botón para hacer la primera carga (unos minutos)." : " Un administrador debe hacer la primera carga."}
          </p>
          {esAdmin && <div className="mt-4 flex justify-center">{botonSync}</div>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={FileCheck2} label="Trámites con resolución de fondo" value={d.total.toLocaleString("es-CO")} />
            <StatCard icon={Stamp} label="Con número de resolución" value={d.conResolucion.toLocaleString("es-CO")} />
            <StatCard
              icon={CalendarClock}
              label="Rango de años"
              value={d.serieAnual.length ? `${d.serieAnual[0].label}–${d.serieAnual[d.serieAnual.length - 1].label}` : "—"}
            />
            <StatCard
              icon={CalendarClock}
              label="Sin fecha de resolución válida"
              value={d.sinFechaValida.toLocaleString("es-CO")}
              help="Registros cuya fecha en SINCA 1.0 tiene un error de digitación (año imposible)."
            />
          </div>

          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-stone-900">Resoluciones de fondo por año</h2>
            <p className="mb-4 text-xs text-stone-500">Según la fecha de la resolución. Los años sin resoluciones se muestran en cero.</p>
            <AreaTrendChart data={d.serieAnual} emptyMessage="No hay datos por año para mostrar." />
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-stone-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-stone-900">Por tipo de trámite</h2>
              <p className="mb-4 text-xs text-stone-500">Los 10 tipos con más resoluciones en el histórico.</p>
              <BarChartHorizontal data={d.porTipo} emptyMessage="Sin datos." />
            </section>
            <section className="rounded-xl border border-stone-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-stone-900">Por municipio</h2>
              <p className="mb-4 text-xs text-stone-500">Los 10 municipios con más resoluciones.</p>
              <BarChartHorizontal data={d.porMunicipio} emptyMessage="Sin datos." />
            </section>
          </div>

          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-stone-900">Por estado de la solicitud</h2>
            <p className="mb-4 text-xs text-stone-500">
              Casi todas son <strong>Aprobada</strong>; el resto quedó negada, desistida o no requería permiso.
            </p>
            <BarChartHorizontal data={d.porEstado} emptyMessage="Sin datos." />
          </section>

          <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-stone-900">Últimas resoluciones</h2>
              <Link href="/historico/solicitudes" className="text-xs font-medium text-cdmb-700 hover:underline">
                Ver todas →
              </Link>
            </div>
            <ul className="divide-y divide-stone-100">
              {d.recientes.map((r) => (
                <li key={r.nroSolicitud}>
                  <Link href={`/historico/solicitudes/${r.nroSolicitud}`} className="block px-5 py-3 hover:bg-stone-50">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                      <span className="font-medium text-stone-800">
                        Resolución {r.numeroResolucion ?? "—"}
                        <span className="ml-2 font-normal text-stone-400">Sol. {r.nroSolicitud}</span>
                      </span>
                      <span className="text-xs text-stone-500">{fecha(r.fechaResolucion)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-stone-500">
                      {r.tipoSolicitudNombre ?? "—"} · {r.municipio ?? "—"}
                      {r.expediente ? ` · Exp. ${r.expediente}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-5 py-4 text-sm">
            <div className="text-stone-600">
              <p>
                Última actualización:{" "}
                <span className="font-medium text-stone-800">{fechaHora(d.ultimaSync?.terminadoEn ?? d.ultimaSync?.iniciadoEn)}</span>
                {d.ultimaSync && !d.ultimaSync.ok && <span className="ml-2 text-red-600">(falló)</span>}
              </p>
              <p className="text-xs text-stone-400">
                {d.ultimaSync?.disparadoPor === "cron" ? "Automática (diaria)" : d.ultimaSync?.disparadoPor?.startsWith("manual") ? "Manual" : d.ultimaSync?.disparadoPor ?? "—"}
              </p>
            </div>
            {botonSync}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  help,
}: {
  icon: typeof FileCheck2;
  label: string;
  value: string | number;
  help?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2 text-stone-400">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="text-xs font-medium text-stone-500">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-stone-900">{value}</p>
      {help && <p className="mt-1 text-xs text-stone-400">{help}</p>}
    </div>
  );
}
