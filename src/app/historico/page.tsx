import { redirect } from "next/navigation";
import { FileCheck2, Stamp, CalendarClock, RefreshCw, Timer, Scale, Hash, BarChart3, Layers, MapPin, ListChecks, ScrollText } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";
import { sincaConfigurado } from "@/lib/sinca";
import { getHistoricoDashboard, getHistoricoOpcionesFiltro } from "@/lib/sinca-data";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { AreaAnual } from "@/components/charts/AreaAnual";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { SelectorPeriodo } from "@/components/SelectorPeriodo";
import { SelectorTramites } from "@/components/SelectorTramites";
import { formatearFecha as fecha, formatearFechaHora as fechaHora } from "@/lib/fecha";
import { CabeceraTablero, EnlaceTablero, FilaTablero, Indicador, ListaTablero, PieTablero, TarjetaTablero } from "@/components/tablero";

const num = (v: number) => v.toLocaleString("es-CO");

export default async function HistoricoPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; tipo?: string } & FiltrosPeriodo>;
}) {
  const sp = await searchParams;
  const { ok, error } = sp;
  const { rango, etiqueta } = resolverPeriodo(sp);
  const session = await getSession();
  if (session) {
    const permisos = await obtenerPermisosUsuario(session.userId);
    if (!puedeAccederSeccion(permisos, "SINCA_DASHBOARD")) redirect("/");
  }
  const esAdmin = session?.rol === "ADMIN";

  if (!sincaConfigurado()) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white shadow-soft p-8 text-center text-sm text-stone-600">
        La conexión con SINCA 1.0 no está configurada en este servidor (variables <code>SINCA_API_URL</code>, <code>SINCA_API_USUARIO</code>, <code>SINCA_API_PASSWORD</code>).
      </div>
    );
  }

  const tipos = sp.tipo?.split(",").filter(Boolean);
  const [d, opciones] = await Promise.all([getHistoricoDashboard(rango, tipos), getHistoricoOpcionesFiltro()]);
  const sinDatos = d.total === 0;
  const selector = (
    <div className="flex flex-wrap items-center gap-2.5">
      <SelectorPeriodo desdeActual={sp.desde} hastaActual={sp.hasta} />
      <SelectorTramites
        opciones={opciones.tipos.map((t) => ({ valor: t.codigo, etiqueta: t.nombre, total: t.total }))}
        paramName="tipo"
        titulo="Tipo de trámite"
      />
    </div>
  );

  const botonSync = esAdmin ? (
    <form action="/api/sinca/sincronizar" method="post">
      <button className="flex items-center gap-1.5 rounded-md border border-menu-500 bg-white px-3 py-1.5 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Sincronizar ahora
      </button>
    </form>
  ) : null;

  return (
    <div className="space-y-4">
      {ok && <div className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</div>}
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {selector}

      {sinDatos ? (
        <div className="rounded-2xl border border-stone-200 bg-white shadow-soft p-8 text-center">
          <p className="text-sm text-stone-600">
            {rango
              ? "No hay resoluciones en el período seleccionado."
              : "Todavía no se ha traído el histórico de SINCA 1.0."}
            {!rango && (esAdmin ? " Use el botón para hacer la primera carga." : " Un administrador debe hacer la primera carga.")}
          </p>
          {!rango && esAdmin && <div className="mt-4 flex justify-center">{botonSync}</div>}
        </div>
      ) : (
        <>
          <CabeceraTablero antetitulo={rango ? etiqueta : "Histórico completo"} titulo="Resoluciones de SINCA 1.0" descripcion="Solicitudes resueltas en el sistema anterior, por fecha de la resolución de fondo.">
            <Indicador icon={FileCheck2} valor={num(d.total)} etiqueta="Solicitudes" tono="cdmb" />
            <Indicador icon={Scale} valor={num(d.aprobadas)} etiqueta="Trámites aprobados" tono="verde" />
            <Indicador icon={Stamp} valor={`${(d.tasaAprobacion * 100).toFixed(1)} %`} etiqueta="Tasa de aprobación" tono="cielo" />
            <Indicador
              icon={Timer}
              valor={d.diasResolucionP50 != null ? `${d.diasResolucionP50} d` : "…"}
              etiqueta="Tiempo mediano"
              detalle={d.diasResolucionP50 != null ? "De radicación a resolución" : "En cálculo"}
              tono="ambar"
            />
            <Indicador
              icon={CalendarClock}
              valor={d.serieAnual.length ? `${d.serieAnual[0].label}–${d.serieAnual[d.serieAnual.length - 1].label}` : "—"}
              etiqueta="Años"
              tono="neutro"
            />
            <Indicador icon={Hash} valor={num(d.conResolucion)} etiqueta="Con N.º de resolución" tono="violeta" />
          </CabeceraTablero>

          <TarjetaTablero icon={BarChart3} tono="acento" titulo="Solicitudes por año" descripcion="Pase el mouse para ver cualquier año.">
            <AreaAnual data={d.serieAnual.map((s) => ({ anio: Number(s.label), valor: s.value }))} emptyMessage="Sin datos por año." />
          </TarjetaTablero>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TarjetaTablero icon={Layers} titulo="Por tipo de trámite" descripcion="Los 10 tipos con más resoluciones.">
              <BarChartHorizontal data={d.porTipo} emptyMessage="Sin datos." />
            </TarjetaTablero>
            <TarjetaTablero icon={MapPin} tono="cielo" titulo="Por municipio" descripcion="Los 10 municipios con más resoluciones.">
              <BarChartHorizontal data={d.porMunicipio} emptyMessage="Sin datos." />
            </TarjetaTablero>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TarjetaTablero icon={ListChecks} tono="verde" titulo="Por estado" descripcion="Aprobadas, negadas, desistidas o sin permiso requerido.">
              <BarChartHorizontal data={d.porEstado} emptyMessage="Sin datos." />
            </TarjetaTablero>
            <TarjetaTablero icon={ScrollText} tono="violeta" titulo="Últimas resoluciones" accion={<EnlaceTablero href="/historico/solicitudes">Ver todas</EnlaceTablero>} sinRelleno>
              <ListaTablero>
                {d.recientes.map((r) => (
                  <FilaTablero
                    key={r.nroSolicitud}
                    href={`/historico/solicitudes/${r.nroSolicitud}`}
                    titulo={
                      <>
                        Res. {r.numeroResolucion ?? "—"}
                        <span className="ml-1.5 font-normal text-stone-400">Sol. {r.nroSolicitud}</span>
                      </>
                    }
                    detalle={`${r.tipoSolicitudNombre ?? "—"} · ${r.municipio ?? "—"}${r.expediente ? ` · ${r.expediente}` : ""}`}
                    extra={<span className="text-xs text-stone-500">{fecha(r.fechaResolucion)}</span>}
                  />
                ))}
              </ListaTablero>
            </TarjetaTablero>
          </div>

          <PieTablero>
            <span>
              Última actualización:{" "}
              <span className="font-medium text-stone-700">{fechaHora(d.ultimaSync?.terminadoEn ?? d.ultimaSync?.iniciadoEn)}</span>
              {d.ultimaSync && !d.ultimaSync.ok && <span className="ml-1.5 text-red-600">(falló)</span>}
              {d.ultimaSync?.disparadoPor === "cron" ? " · automática" : d.ultimaSync?.disparadoPor?.startsWith("manual") ? " · manual" : ""}
              {d.sinFechaValida > 0 && ` · ${num(d.sinFechaValida)} con fecha ilegible en el origen`}
            </span>
            {botonSync}
          </PieTablero>
        </>
      )}
    </div>
  );
}
