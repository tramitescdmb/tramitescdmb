import Link from "next/link";
import { redirect } from "next/navigation";
import { Workflow } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { ETIQUETA_TIPO_PASO, estadoTerminoPaso, pasosFlujoACargo, usuarioFlujo } from "@/lib/flujos";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { formatearFecha, formatearFechaHora } from "@/lib/fecha";
import { TituloSeccion } from "@/components/sgdea/ui";

export default async function PasosFlujoACargoPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");
  const [pasos, calendario] = await Promise.all([pasosFlujoACargo(await usuarioFlujo(session.userId, permisos)), getCalendarioLaboral()]);

  return (
    <div className="space-y-4">
      <TituloSeccion icon={Workflow} contador={pasos.length}>
        Pasos de flujo a mi cargo
      </TituloSeccion>
      {pasos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-200 bg-white p-6 text-center text-sm text-stone-400">
          No tiene pasos de flujos de trabajo pendientes.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-500">
                <th className="px-4 py-2 font-medium">Radicado</th>
                <th className="px-2 py-2 font-medium">Flujo y paso</th>
                <th className="px-2 py-2 font-medium">Desde</th>
                <th className="px-4 py-2 font-medium">Término</th>
              </tr>
            </thead>
            <tbody>
              {pasos.map((i) => {
                const termino = estadoTerminoPaso(i.pasoActualDesde, i.pasoActual?.slaDiasHabiles ?? null, calendario);
                return (
                  <tr key={i.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/correspondencia/${i.comunicacion.id}#flujo`} className="font-mono text-xs font-medium text-cdmb-700 hover:underline">
                        {i.comunicacion.radicado}
                      </Link>
                      <span className="block max-w-xs truncate text-xs text-stone-500">{i.comunicacion.asunto}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className="text-stone-800">{i.pasoActual?.nombre}</span>
                      {i.pasoActual && <span className="ml-1.5 rounded-sm bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">{ETIQUETA_TIPO_PASO[i.pasoActual.tipo]}</span>}
                      <span className="block text-xs text-stone-500">{i.flujo.nombre}</span>
                    </td>
                    <td className="px-2 py-2 text-xs text-stone-600">{i.pasoActualDesde ? formatearFechaHora(i.pasoActualDesde) : "—"}</td>
                    <td className="px-4 py-2 text-xs">
                      {termino ? (
                        <span className={termino.vencido ? "font-medium text-red-600" : termino.diasHabiles <= 1 ? "font-medium text-amber-600" : "text-stone-600"}>
                          {termino.vencido ? `Vencido hace ${termino.diasHabiles} día(s) hábil(es)` : `Vence el ${formatearFecha(termino.limite)}`}
                        </span>
                      ) : (
                        <span className="text-stone-400">Sin término</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
