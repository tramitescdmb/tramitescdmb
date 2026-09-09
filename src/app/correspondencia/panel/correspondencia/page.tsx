import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, Send, ArrowLeftRight, MessageSquareWarning, Files, FolderTree } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { obtenerPanelCorrespondenciaVista } from "@/lib/correspondencia-panel";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { BarrasPorTipo } from "@/components/charts/BarrasPorTipo";
import { EvolucionPorTipo } from "@/components/charts/EvolucionPorTipo";
import { TarjetaKpi, Sub, Panel, TituloSeccion } from "@/components/sgdea/ui";

export default async function PanelCorrespondenciaVistaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");

  const co = await obtenerPanelCorrespondenciaVista(permisos);

  return (
    <section className="space-y-4">
      <TituloSeccion icon={Inbox}>Correspondencia</TituloSeccion>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <TarjetaKpi icon={Inbox} label="Recibidas (mes)" value={co.mes.recibidas} tono="cdmb" href="/correspondencia?tipo=RECIBIDA" />
        <TarjetaKpi icon={Send} label="Enviadas (mes)" value={co.mes.enviadas} tono="azul" href="/correspondencia?tipo=ENVIADA" />
        <TarjetaKpi icon={ArrowLeftRight} label="Memorandos (mes)" value={co.mes.internas} tono="ambar" href="/correspondencia?tipo=INTERNA" />
        <TarjetaKpi icon={MessageSquareWarning} label="PQRSD (mes)" value={co.mes.pqrsd} tono="cian" />
        <TarjetaKpi icon={Files} label="Total histórico" value={co.totalHistorico} href="/correspondencia" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <Sub>Radicados activos por estado</Sub>
          <p className="mb-4 text-xs text-stone-500">
            En qué punto del trámite están los {co.activos.total.toLocaleString("es-CO")} radicados que siguen abiertos.
          </p>
          <BarChartHorizontal data={co.activos.porEstado} emptyMessage="No hay radicados activos por ahora." />
        </Panel>
        <Panel>
          <Sub>Distribución de activos por tipo</Sub>
          <p className="mb-4 text-xs text-stone-500">Porcentaje de los radicados abiertos según su tipo.</p>
          <BarrasPorTipo data={co.activos.porTipo} total={co.activos.total} mostrarPorcentaje emptyMessage="No hay radicados activos por ahora." />
        </Panel>
      </div>

      <Panel>
        <Sub>Evolución de los últimos 6 meses</Sub>
        <p className="mb-4 text-xs text-stone-500">Radicados que siguen activos, por tipo y por mes de radicación.</p>
        <EvolucionPorTipo data={co.evolucion} emptyMessage="Todavía no hay suficiente historial para una tendencia." />
      </Panel>

      {co.esAdmin && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel>
              <Sub>Dependencias con más radicados</Sub>
              <p className="mb-4 text-xs text-stone-500">A qué área se distribuyó cada comunicación recibida.</p>
              <BarChartHorizontal data={co.topDependencias} emptyMessage="Todavía no hay comunicaciones distribuidas a una dependencia." />
            </Panel>
            <Panel>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <Sub>Tiempo de respuesta por dependencia</Sub>
                {co.tiempoRespuesta.general !== null && (
                  <span className="text-xs text-stone-500">
                    Promedio general:{" "}
                    <strong className="tabular-nums text-stone-800">
                      {co.tiempoRespuesta.general.toLocaleString("es-CO")} días
                    </strong>{" "}
                    ({co.tiempoRespuesta.totalRespondidas.toLocaleString("es-CO")} respondidas)
                  </span>
                )}
              </div>
              <p className="mb-4 text-xs text-stone-500">
                Días corridos entre la radicación de una recibida y la de su respuesta formal — el promedio más alto primero.
              </p>
              <BarChartHorizontal
                data={co.tiempoRespuesta.porDependencia}
                emptyMessage="Todavía no hay recibidas con una respuesta radicada."
                formatValue={(n) => `${n.toLocaleString("es-CO")} días`}
              />
            </Panel>
          </div>

          {co.sinClasificar > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
