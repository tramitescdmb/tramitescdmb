import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Inbox, Send, ArrowLeftRight, MessageSquareWarning, FolderOpen, FolderCheck, Files, Handshake,
  Clock, AlertTriangle, PenLine, ListChecks, FolderTree, ShieldAlert, FileWarning, History,
} from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { obtenerPanelCorrespondencia, ETIQUETA_ESTADO_PANEL } from "@/lib/correspondencia-panel";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { estadoVencimiento } from "@/lib/pqrsd";
import { SectionHelp } from "@/components/Field";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { BarrasPorTipo } from "@/components/charts/BarrasPorTipo";
import { EvolucionPorTipo } from "@/components/charts/EvolucionPorTipo";
import { formatearFecha } from "@/lib/fecha";

type IconType = typeof Inbox;

function Kpi({
  icon: Icon, label, value, tono = "neutro", href,
}: {
  icon: IconType; label: string; value: number; tono?: "neutro" | "cdmb" | "azul" | "ambar" | "rojo" | "cian" | "verde"; href?: string;
}) {
  const tonos: Record<string, string> = {
    neutro: "text-stone-400", cdmb: "text-cdmb-600", azul: "text-blue-600",
    ambar: "text-amber-600", cian: "text-cyan-600", rojo: "text-red-600", verde: "text-emerald-600",
  };
  const inner = (
    <div className="rounded-xl border border-stone-200 bg-white p-4 transition hover:border-stone-300">
      <div className="flex items-center gap-2 text-stone-400">
        <Icon className={`h-4 w-4 ${tonos[tono]}`} aria-hidden />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${value > 0 && tono === "rojo" ? "text-red-600" : "text-stone-900"}`}>
        {value.toLocaleString("es-CO")}
      </p>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

function SeccionTitulo({ icon: Icon, children }: { icon: IconType; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 border-b-2 border-cdmb-600 pb-1.5 text-lg font-semibold text-stone-900">
      <Icon className="h-5 w-5 text-cdmb-600" aria-hidden /> {children}
    </h2>
  );
}
function Sub({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-stone-900">{children}</h3>;
}
function Panel({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-stone-200 bg-white p-5">{children}</div>;
}

export default async function PanelCorrespondenciaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");

  const [p, calendario] = await Promise.all([
    obtenerPanelCorrespondencia(session.userId, permisos),
    getCalendarioLaboral(),
  ]);
  const co = p.correspondencia;
  const ex = p.expedientes;

  return (
    <div className="space-y-10">
      <SectionHelp>
        Tablero del SGDEA. Arriba, <strong>su trabajo pendiente</strong>; abajo, el panorama de la
        correspondencia y del archivo de la Corporación{p.esAdmin ? " (con la parte de administración del archivo al final)" : ""}.
      </SectionHelp>

      {/* ============ MI TRABAJO PENDIENTE ============ */}
      <section className="space-y-4">
        <SeccionTitulo icon={ListChecks}>Mi trabajo pendiente</SeccionTitulo>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi icon={ListChecks} label="Asignadas a mí" value={p.mis.total} tono="cdmb" />
          <Kpi icon={PenLine} label="Por responder" value={p.mis.porResponder} tono="azul" />
          <Kpi icon={Clock} label="Por vencer (3 días)" value={p.mis.porVencer} tono="ambar" />
          <Kpi icon={AlertTriangle} label="Vencidas" value={p.mis.vencidas} tono="rojo" />
        </div>
        <p className="text-xs text-stone-400">Cuenta los radicados asignados a usted que siguen abiertos. El detalle está en la tabla.</p>

        {p.mis.lista.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-400">
                  <th className="px-3 py-2 font-medium">Radicado</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Vence</th>
                </tr>
              </thead>
              <tbody>
                {p.mis.lista.map((c) => {
                  const v = estadoVencimiento(c.fechaVencimiento, undefined, calendario);
                  return (
                    <tr key={c.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-3 py-2">
                        <Link href={`/correspondencia/${c.id}`} className="font-medium text-cdmb-700 hover:underline">{c.radicado}</Link>
                        <p className="truncate text-xs text-stone-400">{c.asunto}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-stone-500">{ETIQUETA_ESTADO_PANEL[c.estado]}</td>
                      <td className="px-3 py-2 text-xs">
                        {c.fechaVencimiento ? (
                          <span className={`rounded-full px-2 py-0.5 ${v?.clase ?? "text-stone-500"}`}>{formatearFecha(c.fechaVencimiento)}</span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {co.pendientesProceso > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              {co.pendientesProceso === 1
                ? "1 comunicación recibida entró y nadie la ha distribuido todavía."
                : `${co.pendientesProceso} comunicaciones recibidas entraron y nadie las ha distribuido todavía.`}
            </span>
            {p.puedeDistribuir && (
              <Link href="/correspondencia?tipo=RECIBIDA&estado=EN_REPARTO" className="ml-2 font-medium underline hover:no-underline">Ir a distribuir</Link>
            )}
          </div>
        )}
      </section>

      {/* ============ CORRESPONDENCIA ============ */}
      <section className="space-y-4">
        <SeccionTitulo icon={Inbox}>Correspondencia</SeccionTitulo>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi icon={Inbox} label="Recibidas (mes)" value={co.mes.recibidas} tono="cdmb" href="/correspondencia?tipo=RECIBIDA" />
          <Kpi icon={Send} label="Enviadas (mes)" value={co.mes.enviadas} tono="azul" href="/correspondencia?tipo=ENVIADA" />
          <Kpi icon={ArrowLeftRight} label="Memorandos (mes)" value={co.mes.internas} tono="ambar" href="/correspondencia?tipo=INTERNA" />
          <Kpi icon={MessageSquareWarning} label="PQRSD (mes)" value={co.mes.pqrsd} tono="cian" />
          <Kpi icon={Files} label="Total histórico" value={co.totalHistorico} href="/correspondencia" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel>
            <Sub>Radicados activos por estado</Sub>
            <p className="mb-4 text-xs text-stone-500">En qué punto del trámite están los {co.activos.total.toLocaleString("es-CO")} radicados que siguen abiertos.</p>
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

        {p.esAdmin && (
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
                      Promedio general: <strong className="tabular-nums text-stone-800">{co.tiempoRespuesta.general.toLocaleString("es-CO")} días</strong>{" "}
                      ({co.tiempoRespuesta.totalRespondidas.toLocaleString("es-CO")} respondidas)
                    </span>
                  )}
                </div>
                <p className="mb-4 text-xs text-stone-500">Días corridos entre la radicación de una recibida y la de su respuesta formal — el promedio más alto primero.</p>
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
                <Link href="/correspondencia/admin" className="ml-2 font-medium underline hover:no-underline">Revisar en Administración</Link>
              </div>
            )}
          </>
        )}
      </section>

      {/* ============ EXPEDIENTES Y ARCHIVO ============ */}
      <section className="space-y-4">
        <SeccionTitulo icon={FolderOpen}>Expedientes y archivo</SeccionTitulo>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi icon={FolderOpen} label="Expedientes abiertos" value={ex.abiertos} tono="cdmb" href="/correspondencia/expedientes" />
          <Kpi icon={FolderCheck} label="Expedientes cerrados" value={ex.cerrados} tono="verde" />
          <Kpi icon={Files} label="Documentos en expedientes" value={ex.documentos} />
          <Kpi icon={Handshake} label="Préstamos activos" value={ex.conPrestamoActivo} tono={ex.conPrestamoActivo > 0 ? "ambar" : "neutro"} href="/correspondencia/expedientes" />
        </div>

        {p.esAdmin && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel>
              <Sub>Transferencias a archivo central</Sub>
              <p className="mb-3 text-xs text-stone-500">Estado de las transferencias registradas (el detalle, con fechas, está en Disposición final).</p>
              <dl className="grid grid-cols-3 gap-4">
                <div><dt className="text-[11px] text-stone-400">Registradas</dt><dd className="text-lg font-semibold tabular-nums text-stone-800">{ex.transferencias.total}</dd></div>
                <div><dt className="text-[11px] text-stone-400">Confirmadas</dt><dd className="text-lg font-semibold tabular-nums text-emerald-700">{ex.transferencias.confirmadas}</dd></div>
                <div><dt className="text-[11px] text-stone-400">Sin confirmar</dt><dd className="text-lg font-semibold tabular-nums text-amber-700">{ex.transferencias.sinConfirmar}</dd></div>
              </dl>
            </Panel>
            <Panel>
              <Sub>Tabla de Retención Documental</Sub>
              <p className="mb-3 text-xs text-stone-500">Tamaño actual de la TRD vigente.</p>
              <dl className="grid grid-cols-2 gap-4">
                <div><dt className="text-[11px] text-stone-400">Series vigentes</dt><dd className="text-lg font-semibold tabular-nums text-stone-800">{ex.trd.seriesVigentes}</dd></div>
                <div><dt className="text-[11px] text-stone-400">Subseries activas</dt><dd className="text-lg font-semibold tabular-nums text-stone-800">{ex.trd.subseriesActivas}</dd></div>
              </dl>
              <Link href="/correspondencia/admin" className="mt-3 inline-block text-xs font-medium text-cdmb-700 hover:underline">Administrar TRD →</Link>
            </Panel>
          </div>
        )}
      </section>

      {/* ============ SISTEMA (solo admin) ============ */}
      {p.sistema && (
        <section className="space-y-4">
          <SeccionTitulo icon={ShieldAlert}>Sistema</SeccionTitulo>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Kpi icon={ShieldAlert} label="Accesos fallidos (30 días)" value={p.sistema.accesosFallidos30} tono={p.sistema.accesosFallidos30 > 0 ? "rojo" : "neutro"} />
            <Kpi icon={FileWarning} label="Cargues fallidos (30 días)" value={p.sistema.carguesFallidos30} tono={p.sistema.carguesFallidos30 > 0 ? "ambar" : "neutro"} />
            <Kpi icon={AlertTriangle} label="Errores de ejecución (30 días)" value={p.sistema.erroresEjecucion30} tono={p.sistema.erroresEjecucion30 > 0 ? "ambar" : "neutro"} />
          </div>
          <p className="text-xs text-stone-400">
            <History className="mr-1 inline h-3 w-3" aria-hidden />
            El detalle de cada evento está en la pestaña <Link href="/correspondencia/bitacora" className="font-medium text-cdmb-700 hover:underline">Bitácora</Link>.
          </p>
        </section>
      )}
    </div>
  );
}
