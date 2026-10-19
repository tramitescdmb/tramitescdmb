import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, AlertTriangle, PenLine, ListChecks, Inbox } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { obtenerPanelMiTrabajo, ETIQUETA_ESTADO_PANEL } from "@/lib/correspondencia-panel";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { estadoVencimiento } from "@/lib/pqrsd";
import { formatearFecha } from "@/lib/fecha";
import { CabeceraTablero, EnlaceTablero, Indicador, TarjetaTablero, VacioTablero } from "@/components/tablero";
import { fechaHoyLarga } from "@/lib/saludo";

export default async function PanelMiTrabajoPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");

  const [p, calendario] = await Promise.all([
    obtenerPanelMiTrabajo(session.userId, permisos),
    getCalendarioLaboral(),
  ]);

  return (
    <section className="space-y-4">
      <CabeceraTablero antetitulo={fechaHoyLarga()} titulo="Pendientes" descripcion="Radicados asignados a usted que siguen abiertos.">
        <Indicador icon={ListChecks} valor={p.mis.total} etiqueta="Asignados" tono="cdmb" />
        <Indicador icon={PenLine} valor={p.mis.porResponder} etiqueta="Por responder" tono="cielo" />
        <Indicador icon={Clock} valor={p.mis.porVencer} etiqueta="Por vencer (3 días)" tono="ambar" />
        <Indicador icon={AlertTriangle} valor={p.mis.vencidas} etiqueta="Vencidas" tono="rojo" alerta={p.mis.vencidas > 0} />
      </CabeceraTablero>

      <TarjetaTablero
        icon={Inbox}
        tono="cielo"
        titulo="Radicados asignados"
        contador={p.mis.lista.length}
        accion={<EnlaceTablero href="/correspondencia">Bandeja de radicados</EnlaceTablero>}
        sinRelleno
      >
        {p.mis.lista.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="tabla-listado w-full text-xs">
              <thead className="bg-stone-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-5 py-1.5">Radicado</th>
                  <th className="px-3 py-1.5">Estado</th>
                  <th className="px-5 py-1.5">Vence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {p.mis.lista.map((c) => {
                  const v = estadoVencimiento(c.fechaVencimiento, undefined, calendario);
                  return (
                    <tr key={c.id} className="hover:bg-stone-50/70">
                      <td className="px-5 py-2">
                        <Link href={`/correspondencia/${c.id}`} className="font-medium text-stone-800 hover:text-cdmb-700">
                          {c.radicado}
                        </Link>
                        <p className="truncate text-[11px] text-stone-400">{c.asunto}</p>
                      </td>
                      <td className="px-3 py-2 text-stone-500">{ETIQUETA_ESTADO_PANEL[c.estado]}</td>
                      <td className="whitespace-nowrap px-5 py-2">
                        {c.fechaVencimiento ? (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${v?.clase ?? "text-stone-500"}`}>{formatearFecha(c.fechaVencimiento)}</span>
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
        ) : (
          <VacioTablero>Sin radicados asignados pendientes.</VacioTablero>
        )}
      </TarjetaTablero>

      {p.pendientesProceso > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {p.pendientesProceso === 1
              ? "1 comunicación recibida está a la espera de que la ventanilla la reparta"
              : `${p.pendientesProceso} comunicaciones recibidas están a la espera de que la ventanilla las reparta`}
            {p.devueltasEsperandoReparto > 0 && (
              <> ({p.devueltasEsperandoReparto} {p.devueltasEsperandoReparto === 1 ? "fue devuelta" : "fueron devueltas"} por el funcionario)</>
            )}
            .
          </span>
          {p.puedeDistribuir && (
            <Link
              href="/correspondencia?tipo=RECIBIDA&estado=EN_REPARTO"
              className="ml-2 font-medium underline hover:no-underline"
            >
              Ir a repartir
            </Link>
          )}
        </div>
      )}

      {p.oficiosSinDespachar > 0 && p.puedeDespachar && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {p.oficiosSinDespachar === 1
              ? "1 oficio de salida está radicado y firmado pero sin despachar al destinatario."
              : `${p.oficiosSinDespachar} oficios de salida están radicados y firmados pero sin despachar al destinatario.`}
          </span>
          <Link
            href="/correspondencia?tipo=ENVIADA&despacho=sin_despachar"
            className="ml-2 font-medium underline hover:no-underline"
          >
            Ver cuáles
          </Link>
        </div>
      )}

      {p.flujosPasoVencido > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {p.flujosPasoVencido === 1
              ? "1 flujo de trabajo tiene el término de su paso actual vencido."
              : `${p.flujosPasoVencido} flujos de trabajo tienen el término de su paso actual vencido.`}
          </span>
        </div>
      )}

      {(p.global.vencidas > 0 || p.global.porVencer > 0) && (
        <p className="text-xs text-stone-400">
          En toda la Corporación hay{" "}
          <Link href="/correspondencia?vencimiento=vencidas" className="font-medium text-cdmb-700 hover:underline">
            {p.global.vencidas.toLocaleString("es-CO")} vencidas
          </Link>{" "}
          y{" "}
          <Link href="/correspondencia?vencimiento=por_vencer" className="font-medium text-cdmb-700 hover:underline">
            {p.global.porVencer.toLocaleString("es-CO")} por vencer
          </Link>
          .
        </p>
      )}
    </section>
  );
}
