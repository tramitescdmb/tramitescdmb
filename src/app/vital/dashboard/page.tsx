import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, FileStack, Layers, CalendarClock } from "lucide-react";
import { vitalConfigurado } from "@/lib/vital";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";
import { getVitalDashboard } from "@/lib/vital-data";
import { SectionHelp } from "@/components/Field";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { AreaAnual } from "@/components/charts/AreaAnual";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { SelectorPeriodo } from "@/components/SelectorPeriodo";

const num = (v: number) => v.toLocaleString("es-CO");
const fechaHora = (d: Date | null) =>
  d ? d.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default async function VitalDashboardPage({ searchParams }: { searchParams: Promise<FiltrosPeriodo> }) {
  const sp = await searchParams;
  const { rango, etiqueta } = resolverPeriodo(sp);
  const session = await getSession();
  if (session) {
    const permisos = await obtenerPermisosUsuario(session.userId);
    if (!puedeAccederSeccion(permisos, "VITAL_DASHBOARD")) redirect("/");
  }
  if (!vitalConfigurado()) {
    return <SectionHelp>La conexión con VITAL no está configurada en este servidor.</SectionHelp>;
  }

  const d = await getVitalDashboard(rango);
  if (d.total === 0) {
    return (
      <div className="space-y-4">
        <SelectorPeriodo desdeActual={sp.desde} hastaActual={sp.hasta} />
        <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
          {rango
            ? "No hay solicitudes de VITAL en el período seleccionado."
            : "Todavía no se ha traído ninguna solicitud de VITAL. Un administrador puede sincronizar desde la pestaña Solicitudes."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SelectorPeriodo desdeActual={sp.desde} hastaActual={sp.hasta} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kpi icon={Inbox} label="Solicitudes traídas" value={num(d.total)} />
        <Kpi icon={Layers} label="Tipos de trámite" value={num(d.tramitesDistintos)} />
        <Kpi icon={FileStack} label="Con documentos" value={num(d.conDocs)} />
        <Kpi
          icon={CalendarClock}
          label="Rango de radicación"
          value={d.serieAnual.length ? `${d.serieAnual[0].anio}–${d.serieAnual[d.serieAnual.length - 1].anio}` : "—"}
        />
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-stone-900">Solicitudes radicadas por mes</h2>
        <p className="mb-2 text-xs text-stone-500">{rango ? etiqueta : "Últimos 24 meses"}, por fecha de radicación en VITAL.</p>
        <AreaTrendChart data={d.serieMensual} emptyMessage="Sin datos mensuales." />
      </section>

      {d.serieAnual.length >= 2 && (
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-900">Por año</h2>
          <p className="mb-2 text-xs text-stone-500">Radicaciones por año (según la fecha que reporta VITAL).</p>
          <AreaAnual data={d.serieAnual} emptyMessage="Sin datos por año." />
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-900">Por tipo de trámite</h2>
          <p className="mb-3 text-xs text-stone-500">Cuántas solicitudes hay de cada trámite VITAL.</p>
          <BarChartHorizontal data={d.porTramite} emptyMessage="Sin datos." />
        </section>
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-900">Por actividad</h2>
          <p className="mb-3 text-xs text-stone-500">Las 10 actividades más frecuentes en el flujo de VITAL.</p>
          <BarChartHorizontal data={d.porActividad} emptyMessage="Sin datos." />
        </section>
      </div>

      {d.recurrentes.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-900">Solicitantes recurrentes</h2>
            <p className="text-xs text-stone-500">Quiénes más radican en VITAL (por identificación).</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">Solicitante</th>
                <th className="px-4 py-2 font-medium">Identificación</th>
                <th className="px-4 py-2 text-right font-medium">Solicitudes</th>
                <th className="px-4 py-2 text-right font-medium">Trámites distintos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {d.recurrentes.map((r) => (
                <tr key={r.nit}>
                  <td className="px-4 py-2 text-stone-800">{r.nombre ?? "—"}</td>
                  <td className="px-4 py-2 text-stone-500">{r.nit}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums text-stone-800">{r.total}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500">{r.tramites}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-xs text-stone-500">
        <span>
          Última sincronización con VITAL: <span className="font-medium text-stone-700">{fechaHora(d.ultimaSync)}</span>
        </span>
        <Link href="/vital" className="font-medium text-cdmb-700 hover:underline">Ver solicitudes →</Link>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Inbox; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-stone-500">
        <Icon className="h-3.5 w-3.5 text-stone-400" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums leading-tight text-stone-900">{value}</p>
    </div>
  );
}
