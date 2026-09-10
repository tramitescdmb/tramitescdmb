import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, AlertTriangle, PenLine, ListChecks } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { obtenerPanelMiTrabajo, ETIQUETA_ESTADO_PANEL } from "@/lib/correspondencia-panel";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { estadoVencimiento } from "@/lib/pqrsd";
import { formatearFecha } from "@/lib/fecha";
import { TarjetaKpi, TituloSeccion } from "@/components/sgdea/ui";

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
      <TituloSeccion icon={ListChecks}>Mi trabajo pendiente</TituloSeccion>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TarjetaKpi icon={ListChecks} label="Asignadas a mí" value={p.mis.total} tono="cdmb" />
        <TarjetaKpi icon={PenLine} label="Por responder" value={p.mis.porResponder} tono="azul" />
        <TarjetaKpi icon={Clock} label="Por vencer (3 días)" value={p.mis.porVencer} tono="ambar" />
        <TarjetaKpi icon={AlertTriangle} label="Vencidas" value={p.mis.vencidas} tono="rojo" />
      </div>
      <p className="text-xs text-stone-400">
        Cuenta los radicados asignados a usted que siguen abiertos. El detalle está en la tabla.
      </p>

      {p.mis.lista.length > 0 ? (
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
                      <Link href={`/correspondencia/${c.id}`} className="font-medium text-cdmb-700 hover:underline">
                        {c.radicado}
                      </Link>
                      <p className="truncate text-xs text-stone-400">{c.asunto}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-stone-500">{ETIQUETA_ESTADO_PANEL[c.estado]}</td>
                    <td className="px-3 py-2 text-xs">
                      {c.fechaVencimiento ? (
                        <span className={`rounded-full px-2 py-0.5 ${v?.clase ?? "text-stone-500"}`}>
                          {formatearFecha(c.fechaVencimiento)}
                        </span>
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
        <p className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400">
          No tiene radicados asignados pendientes.
        </p>
      )}

      {p.pendientesProceso > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
