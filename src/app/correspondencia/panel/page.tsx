import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Inbox, Send, ArrowLeftRight, MessageSquareWarning, FolderOpen,
  Clock, AlertTriangle, PenLine, ListChecks, TrendingUp, GitBranch,
} from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { obtenerPanelCorrespondencia, ETIQUETA_ESTADO_PANEL } from "@/lib/correspondencia-panel";
import { estadoVencimiento } from "@/lib/pqrsd";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { SectionHelp } from "@/components/Field";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { BarrasPorTipo } from "@/components/charts/BarrasPorTipo";
import { EvolucionPorTipo } from "@/components/charts/EvolucionPorTipo";
import { formatearFecha } from "@/lib/fecha";

type IconType = typeof Inbox;

function Kpi({
  icon: Icon, label, value, tono = "neutro", href,
}: {
  icon: IconType; label: string; value: number; tono?: "neutro" | "cdmb" | "azul" | "ambar" | "rojo" | "cian"; href?: string;
}) {
  const tonos: Record<string, string> = {
    neutro: "text-stone-400",
    cdmb: "text-cdmb-600",
    azul: "text-blue-600",
    ambar: "text-amber-600",
    cian: "text-cyan-600",
    rojo: "text-red-600",
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

export default async function PanelCorrespondenciaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");

  const [p, calendario] = await Promise.all([
    obtenerPanelCorrespondencia(session.userId, permisos),
    getCalendarioLaboral(),
  ]);

  return (
    <div className="space-y-8">
      <SectionHelp>
        Panel operativo del SGDEA: arriba, <strong>su trabajo pendiente</strong>; abajo, el panorama de la
        correspondencia de la Corporación. Los números enlazan a la bandeja ya filtrada.
      </SectionHelp>

      {/* --- Mis pendientes --- */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <ListChecks className="h-4 w-4 text-cdmb-600" aria-hidden /> Mi trabajo pendiente
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi icon={ListChecks} label="Asignadas a mí" value={p.mis.total} tono="cdmb" />
          <Kpi icon={PenLine} label="Por responder" value={p.mis.porResponder} tono="azul" />
          <Kpi icon={Clock} label="Por vencer (3 días)" value={p.mis.porVencer} tono="ambar" />
          <Kpi icon={AlertTriangle} label="Vencidas" value={p.mis.vencidas} tono="rojo" />
        </div>
        <p className="text-xs text-stone-400">
          Cuenta los radicados asignados a usted que siguen abiertos. El detalle está en la tabla de abajo.
        </p>
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
      </section>

      {/* --- Radicados del mes --- */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <TrendingUp className="h-4 w-4 text-cdmb-600" aria-hidden /> Radicado este mes
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi icon={Inbox} label="Recibidas" value={p.mes.recibidas} tono="cdmb" href="/correspondencia?tipo=RECIBIDA" />
          <Kpi icon={Send} label="Enviadas" value={p.mes.enviadas} tono="azul" href="/correspondencia?tipo=ENVIADA" />
          <Kpi icon={ArrowLeftRight} label="Memorandos" value={p.mes.internas} tono="ambar" href="/correspondencia?tipo=INTERNA" />
          <Kpi icon={MessageSquareWarning} label="PQRSD" value={p.mes.pqrsd} tono="cian" />
          <Kpi icon={FolderOpen} label="Expedientes abiertos" value={p.mes.expedientesAbiertos} href="/correspondencia/expedientes" />
        </div>
      </section>

      {/* --- Estado de la tramitación --- */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <GitBranch className="h-4 w-4 text-cdmb-600" aria-hidden /> Estado de la tramitación
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-stone-900">Radicados activos por estado</h3>
            <p className="mb-4 text-xs text-stone-500">En qué punto del trámite están los {p.totalActivos.toLocaleString("es-CO")} radicados que siguen abiertos.</p>
            <BarChartHorizontal data={p.porEstado} emptyMessage="No hay radicados activos por ahora." />
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-stone-900">Distribución de activos por tipo</h3>
            <p className="mb-4 text-xs text-stone-500">Porcentaje de los radicados abiertos según su tipo.</p>
            <BarrasPorTipo data={p.porTipoActivo} total={p.totalActivos} mostrarPorcentaje emptyMessage="No hay radicados activos por ahora." />
          </div>
        </div>
      </section>

      {/* --- Pendientes de proceso --- */}
      {p.totalPendientesProceso > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {p.totalPendientesProceso === 1
              ? "1 comunicación recibida entró y nadie la ha distribuido todavía."
              : `${p.totalPendientesProceso} comunicaciones recibidas entraron y nadie las ha distribuido todavía.`}
          </span>
          {p.puedeDistribuir && (
            <Link href="/correspondencia?tipo=RECIBIDA&estado=EN_REPARTO" className="ml-2 font-medium underline hover:no-underline">
              Ir a distribuir
            </Link>
          )}
        </div>
      )}

      {/* --- Evolución --- */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <TrendingUp className="h-4 w-4 text-cdmb-600" aria-hidden /> Evolución de los últimos 6 meses
        </h2>
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <p className="mb-4 text-xs text-stone-500">
            Radicados que siguen activos, por tipo y por mes de radicación.
          </p>
          <EvolucionPorTipo data={p.evolucion} emptyMessage="Todavía no hay suficiente historial para una tendencia." />
        </div>
      </section>
    </div>
  );
}
