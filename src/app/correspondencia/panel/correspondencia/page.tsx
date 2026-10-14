import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, Send, ArrowLeftRight, MessageSquareWarning, Files, FolderTree, ListChecks, PieChart, TrendingUp, Building2, Timer } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { obtenerPanelCorrespondenciaVista } from "@/lib/correspondencia-panel";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { BarrasPorTipo } from "@/components/charts/BarrasPorTipo";
import { EvolucionPorTipo } from "@/components/charts/EvolucionPorTipo";
import { CabeceraTablero, Indicador, TarjetaTablero } from "@/components/tablero";

export default async function PanelCorrespondenciaVistaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");

  const co = await obtenerPanelCorrespondenciaVista(permisos);

  return (
    <section className="space-y-4">
      <CabeceraTablero antetitulo="Mes en curso" titulo="Correspondencia" descripcion="Radicados del mes y estado de los que siguen abiertos.">
        <Indicador icon={Inbox} valor={co.mes.recibidas} etiqueta="Recibidas" tono="cdmb" href="/correspondencia?tipo=RECIBIDA" />
        <Indicador icon={Send} valor={co.mes.enviadas} etiqueta="Enviadas" tono="cielo" href="/correspondencia?tipo=ENVIADA" />
        <Indicador icon={ArrowLeftRight} valor={co.mes.internas} etiqueta="Memorandos" tono="ambar" href="/correspondencia?tipo=INTERNA" />
        <Indicador icon={MessageSquareWarning} valor={co.mes.pqrsd} etiqueta="PQRSD" tono="violeta" />
        <Indicador icon={Files} valor={co.totalHistorico} etiqueta="Total histórico" tono="neutro" href="/correspondencia" />
      </CabeceraTablero>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TarjetaTablero icon={ListChecks} titulo="Radicados activos por estado" contador={co.activos.total}>
          <BarChartHorizontal data={co.activos.porEstado} emptyMessage="No hay radicados activos por ahora." />
        </TarjetaTablero>
        <TarjetaTablero icon={PieChart} tono="cielo" titulo="Activos por tipo" descripcion="Porcentaje de los radicados abiertos.">
          <BarrasPorTipo data={co.activos.porTipo} total={co.activos.total} mostrarPorcentaje emptyMessage="No hay radicados activos por ahora." />
        </TarjetaTablero>
      </div>

      <TarjetaTablero icon={TrendingUp} tono="acento" titulo="Evolución de los últimos 6 meses" descripcion="Radicados activos por tipo y mes de radicación.">
        <EvolucionPorTipo data={co.evolucion} emptyMessage="Todavía no hay suficiente historial para una tendencia." />
      </TarjetaTablero>

      {co.esAdmin && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TarjetaTablero icon={Building2} tono="cielo" titulo="Dependencias con más radicados" descripcion="Área a la que se distribuyó cada recibida.">
              <BarChartHorizontal data={co.topDependencias} emptyMessage="Todavía no hay comunicaciones distribuidas a una dependencia." />
            </TarjetaTablero>
            <TarjetaTablero
              icon={Timer}
              tono="ambar"
              titulo="Tiempo de respuesta por dependencia"
              descripcion={
                co.tiempoRespuesta.general !== null
                  ? `Días corridos hasta la respuesta formal. Promedio general: ${co.tiempoRespuesta.general.toLocaleString("es-CO")} días (${co.tiempoRespuesta.totalRespondidas.toLocaleString("es-CO")} respondidas).`
                  : "Días corridos entre la radicación de una recibida y la de su respuesta formal."
              }
            >
              <BarChartHorizontal
                data={co.tiempoRespuesta.porDependencia}
                emptyMessage="Todavía no hay recibidas con una respuesta radicada."
                formatValue={(n) => `${n.toLocaleString("es-CO")} días`}
              />
            </TarjetaTablero>
          </div>

          {co.sinClasificar > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <FolderTree className="h-4 w-4" aria-hidden />
                {co.sinClasificar === 1 ? "1 comunicación" : `${co.sinClasificar} comunicaciones`} sin clasificación TRD completa.
              </span>
              <Link href="/correspondencia/admin" className="ml-2 font-medium underline hover:no-underline">
                Revisar en Configuración
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
