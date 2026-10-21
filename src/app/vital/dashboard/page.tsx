import { redirect } from "next/navigation";
import { hrefLista } from "@/lib/tableros";
import { MarcoDashboard, RejillaIndicadores, RejillaTarjetas } from "@/components/inicio/BarraDashboard";
import { Inbox, FileStack, Layers, CalendarClock, TrendingUp, Activity, Users, PieChart } from "lucide-react";
import { vitalConfigurado } from "@/lib/vital";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";
import { getVitalDashboard, getVitalOpcionesFiltro } from "@/lib/vital-data";
import { SectionHelp } from "@/components/Field";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { Dona } from "@/components/charts/Dona";
import { PALETA_TIPOS } from "@/lib/geovisor-capas-externas";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { SelectorPeriodo } from "@/components/SelectorPeriodo";
import { SelectorTramites } from "@/components/SelectorTramites";
import { formatearFechaHora as fechaHora } from "@/lib/fecha";
import { EnlaceTablero, FilaTablero, Indicador, ListaTablero, PieTablero, TarjetaTablero, VacioTablero } from "@/components/tablero";

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
  const hrefVital = (extra: Record<string, string> = {}) => hrefLista("/vital", { tramite: sp.tramite, desde: sp.desde, hasta: sp.hasta, ...extra });
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
        <Indicador icon={Inbox} valor={num(d.total)} etiqueta="Solicitudes traídas" tono="cdmb" href={hrefVital()} />
        <Indicador icon={Layers} valor={num(d.tramitesDistintos)} etiqueta="Tipos de trámite" tono="cielo" />
        <Indicador icon={FileStack} valor={num(d.conDocs)} etiqueta="Con documentos" tono="ambar" href={hrefVital({ documentos: "con" })} />
        <Indicador
          icon={CalendarClock}
          valor={d.serieAnual.length ? `${d.serieAnual[0].anio}–${d.serieAnual[d.serieAnual.length - 1].anio}` : "—"}
          etiqueta="Rango de radicación"
          tono="neutro"
        />
      </RejillaIndicadores>

      <RejillaTarjetas>
        <TarjetaTablero className="lg:col-span-8" icon={TrendingUp} tono="acento" titulo="Solicitudes radicadas por mes" descripcion={`${rango ? etiqueta : "Últimos 24 meses"}, por fecha de radicación en VITAL.`}>
          <AreaTrendChart data={d.serieMensual} emptyMessage="Sin datos mensuales." />
        </TarjetaTablero>
        <TarjetaTablero className="lg:col-span-4" icon={PieChart} tono="cielo" titulo="Por año" contador={d.total} descripcion="Según la fecha que reporta VITAL.">
          <Dona
            unidad="solicitudes"
            vacio="Sin datos por año."
            segmentos={[
              ...d.serieAnual.map((a, i) => ({
                etiqueta: String(a.anio),
                valor: a.valor,
                color: PALETA_TIPOS[i % PALETA_TIPOS.length]!,
                href: hrefLista("/vital", { tramite: sp.tramite, desde: `${a.anio}-01-01`, hasta: `${a.anio}-12-31` }),
              })),
              { etiqueta: "Sin fecha", valor: Math.max(0, d.total - d.serieAnual.reduce((t, a) => t + a.valor, 0)), color: "#b9c2bc" },
            ]}
          />
        </TarjetaTablero>
        <TarjetaTablero className="lg:col-span-4" icon={Layers} titulo="Por tipo de trámite" descripcion="Solicitudes de cada trámite VITAL.">
          <BarChartHorizontal data={d.porTramite} emptyMessage="Sin datos." />
        </TarjetaTablero>
        <TarjetaTablero className="lg:col-span-4" icon={Activity} tono="violeta" titulo="Por actividad" descripcion="Las 10 actividades más frecuentes en el flujo de VITAL.">
          <BarChartHorizontal data={d.porActividad} emptyMessage="Sin datos." />
        </TarjetaTablero>
        <TarjetaTablero className="lg:col-span-4" icon={Users} tono="ambar" titulo="Solicitantes recurrentes" descripcion="Quiénes más radican, por identificación." sinRelleno>
          {d.recurrentes.length === 0 ? (
            <VacioTablero>Sin solicitantes recurrentes.</VacioTablero>
          ) : (
            <ListaTablero>
              {d.recurrentes.map((r) => (
                <FilaTablero
                  key={r.nit}
                  titulo={r.nombre ?? r.nit}
                  detalle={`${r.nombre ? `${r.nit} · ` : ""}${r.tramites} trámite${r.tramites === 1 ? "" : "s"} distinto${r.tramites === 1 ? "" : "s"}`}
                  extra={<span className="text-sm font-semibold tabular-nums text-stone-700">{r.total}</span>}
                />
              ))}
            </ListaTablero>
          )}
        </TarjetaTablero>
      </RejillaTarjetas>


      <PieTablero>
        <span>
          Última sincronización con VITAL: <span className="font-medium text-stone-700">{fechaHora(d.ultimaSync)}</span>
        </span>
        <EnlaceTablero href="/vital">Ver solicitudes</EnlaceTablero>
      </PieTablero>
    </MarcoDashboard>
  );
}
