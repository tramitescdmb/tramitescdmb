import { redirect } from "next/navigation";
import { MarcoDashboard, RejillaIndicadores, RejillaTarjetas } from "@/components/inicio/BarraDashboard";
import { Inbox, FileStack, Layers, CalendarClock, TrendingUp, BarChart3, Activity, Users } from "lucide-react";
import { vitalConfigurado } from "@/lib/vital";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";
import { getVitalDashboard, getVitalOpcionesFiltro } from "@/lib/vital-data";
import { SectionHelp } from "@/components/Field";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { AreaAnual } from "@/components/charts/AreaAnual";
import { LineasMensuales } from "@/components/charts/LineasMensuales";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { SelectorPeriodo } from "@/components/SelectorPeriodo";
import { SelectorTramites } from "@/components/SelectorTramites";
import { formatearFechaHora as fechaHora } from "@/lib/fecha";
import { EnlaceTablero, Indicador, PieTablero, TarjetaTablero } from "@/components/tablero";

const num = (v: number) => v.toLocaleString("es-CO");

export default async function VitalDashboardPage({ searchParams }: { searchParams: Promise<FiltrosPeriodo & { tramite?: string }> }) {
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

  const tramitesSeleccionados = sp.tramite?.split(",").map((x) => parseInt(x, 10)).filter(Number.isFinite);
  const [d, opciones] = await Promise.all([getVitalDashboard(rango, tramitesSeleccionados), getVitalOpcionesFiltro()]);
  const filtros = (
    <>
      <SelectorPeriodo desdeActual={sp.desde} hastaActual={sp.hasta} compacto />
      <SelectorTramites
        opciones={opciones.tramites.map((t) => ({ valor: String(t.id), etiqueta: t.nombre, total: t.total }))}
        paramName="tramite"
        titulo="Trámite"
      />
    </>
  );
  if (d.total === 0) {
    return (
      <MarcoDashboard actual="/vital/dashboard" filtros={filtros}>
        <p className="rounded-2xl border border-stone-200 bg-white shadow-soft p-8 text-center text-sm text-stone-600">
          {rango || (tramitesSeleccionados && tramitesSeleccionados.length > 0)
            ? "No hay solicitudes de VITAL con estos filtros."
            : "Todavía no se ha traído ninguna solicitud de VITAL. Un administrador puede sincronizar desde la pestaña Solicitudes."}
        </p>
      </MarcoDashboard>
    );
  }

  return (
    <MarcoDashboard actual="/vital/dashboard" filtros={filtros}>
      <RejillaIndicadores>
        <Indicador icon={Inbox} valor={num(d.total)} etiqueta="Solicitudes traídas" tono="cdmb" />
        <Indicador icon={Layers} valor={num(d.tramitesDistintos)} etiqueta="Tipos de trámite" tono="cielo" />
        <Indicador icon={FileStack} valor={num(d.conDocs)} etiqueta="Con documentos" tono="ambar" />
        <Indicador
          icon={CalendarClock}
          valor={d.serieAnual.length ? `${d.serieAnual[0].anio}–${d.serieAnual[d.serieAnual.length - 1].anio}` : "—"}
          etiqueta="Rango de radicación"
          tono="neutro"
        />
      </RejillaIndicadores>

      <RejillaTarjetas>
        <TarjetaTablero className={d.serieAnual.length >= 2 ? "lg:col-span-8" : "lg:col-span-12"} icon={TrendingUp} tono="acento" titulo="Solicitudes radicadas por mes" descripcion={`${rango ? etiqueta : "Últimos 24 meses"}, por fecha de radicación en VITAL.`}>
          <LineasMensuales series={[{ nombre: "Radicadas", color: "#2a78d6" }]} datos={d.serieMensual.map((p) => ({ etiqueta: p.label, valores: [p.value] }))} vacio="Sin datos mensuales." />
        </TarjetaTablero>
        {d.serieAnual.length >= 2 && (
          <TarjetaTablero className="lg:col-span-4" icon={BarChart3} tono="cielo" titulo="Por año" descripcion="Según la fecha que reporta VITAL.">
            <AreaAnual data={d.serieAnual} emptyMessage="Sin datos por año." />
          </TarjetaTablero>
        )}
        <TarjetaTablero className="lg:col-span-6" icon={Layers} titulo="Por tipo de trámite" descripcion="Solicitudes de cada trámite VITAL.">
          <BarChartHorizontal data={d.porTramite} emptyMessage="Sin datos." />
        </TarjetaTablero>
        <TarjetaTablero className="lg:col-span-6" icon={Activity} tono="violeta" titulo="Por actividad" descripcion="Las 10 actividades más frecuentes en el flujo de VITAL.">
          <BarChartHorizontal data={d.porActividad} emptyMessage="Sin datos." />
        </TarjetaTablero>
      </RejillaTarjetas>

      {d.recurrentes.length > 0 && (
        <TarjetaTablero icon={Users} tono="ambar" titulo="Solicitantes recurrentes" descripcion="Quiénes más radican en VITAL, por identificación." sinRelleno>
          <div className="overflow-x-auto">
            <table className="tabla-listado w-full text-xs">
              <thead className="bg-stone-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-5 py-1.5">Solicitante</th>
                  <th className="px-3 py-1.5">Identificación</th>
                  <th className="px-3 py-1.5 text-right">Solicitudes</th>
                  <th className="px-5 py-1.5 text-right">Trámites distintos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {d.recurrentes.map((r) => (
                  <tr key={r.nit} className="hover:bg-stone-50/70">
                    <td className="px-5 py-1.5 text-stone-800">{r.nombre ?? "—"}</td>
                    <td className="px-3 py-1.5 text-stone-500">{r.nit}</td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums text-stone-800">{r.total}</td>
                    <td className="px-5 py-1.5 text-right tabular-nums text-stone-500">{r.tramites}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TarjetaTablero>
      )}

      <PieTablero>
        <span>
          Última sincronización con VITAL: <span className="font-medium text-stone-700">{fechaHora(d.ultimaSync)}</span>
        </span>
        <EnlaceTablero href="/vital">Ver solicitudes</EnlaceTablero>
      </PieTablero>
    </MarcoDashboard>
  );
}
