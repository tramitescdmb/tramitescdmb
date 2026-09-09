import { Workflow, CheckCircle2, XCircle, ArrowRight, CircleDot } from "lucide-react";
import type { TipoComunicacion } from "@prisma/client";
import { flujosAplicables, obtenerInstanciasDeComunicacion, ETIQUETA_TIPO_PASO } from "@/lib/flujos";
import { flujoAMermaid } from "@/lib/flujos-diagrama";
import { Flujograma } from "@/components/Flujograma";
import { formatearFechaHora } from "@/lib/fecha";

/**
 * Flujo de trabajo de una comunicación (MoReq cap. 7). Muestra la instancia en
 * curso con su paso actual y las opciones para avanzar, el historial de pasos
 * completados, y — si no hay ninguno en curso — el selector para aplicar un
 * flujo activo. Server component; las acciones van por /api/correspondencia/[id]/flujo.
 */
export async function FlujoTrabajoComunicacion({
  comunicacionId,
  tipo,
  estado,
  puedeOperar,
}: {
  comunicacionId: string;
  tipo: TipoComunicacion;
  estado: string;
  puedeOperar: boolean;
}) {
  const [instancias, aplicables] = await Promise.all([
    obtenerInstanciasDeComunicacion(comunicacionId),
    puedeOperar && estado !== "ANULADA" ? flujosAplicables(tipo) : Promise.resolve([]),
  ]);
  const enCurso = instancias.find((i) => i.estado === "EN_CURSO");
  const historial = instancias.filter((i) => i !== enCurso);
  const accion = `/api/correspondencia/${comunicacionId}/flujo`;

  return (
    <section id="flujo" className="scroll-mt-4 rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
        <Workflow className="h-4 w-4 text-cdmb-600" aria-hidden /> Flujo de trabajo
      </h2>

      {enCurso ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-stone-500">
            Flujo <strong className="text-stone-700">{enCurso.flujo.nombre}</strong> · iniciado por{" "}
            {enCurso.iniciadoPor?.nombre ?? "—"} el {formatearFechaHora(enCurso.iniciadoEn)}
          </p>

          <Flujograma
            definicion={flujoAMermaid(
              enCurso.flujo.pasos,
              enCurso.flujo.pasos.flatMap((p) => p.transiciones),
              {
                pasoActualId: enCurso.pasoActualId,
                pasosHechosIds: enCurso.ejecuciones.map((e) => e.paso.id),
              },
            )}
          />

          {/* Línea de tiempo */}
          <ol className="space-y-1.5">
            {enCurso.ejecuciones.map((e) => (
              <li key={e.id} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-600" aria-hidden />
                <span>
                  <strong className="text-stone-700">{e.paso.nombre}</strong>
                  {e.resultado ? <> → <span className="text-cdmb-700">{e.resultado}</span></> : null} ·{" "}
                  {e.responsable?.nombre ?? "—"} · {formatearFechaHora(e.completadoEn)}
                  {e.comentario ? <span className="block text-stone-400">{e.comentario}</span> : null}
                </span>
              </li>
            ))}
            {enCurso.pasoActual && (
              <li className="flex items-start gap-2 text-xs">
                <CircleDot className="mt-0.5 h-3.5 w-3.5 flex-none text-cdmb-600" aria-hidden />
                <span>
                  <strong className="text-stone-900">{enCurso.pasoActual.nombre}</strong>{" "}
                  <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">
                    {ETIQUETA_TIPO_PASO[enCurso.pasoActual.tipo]}
                  </span>
                  <span className="block text-stone-400">Paso actual — pendiente</span>
                </span>
              </li>
            )}
          </ol>

          {enCurso.pasoActual?.instrucciones && (
            <p className="rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-600">{enCurso.pasoActual.instrucciones}</p>
          )}

          {puedeOperar && enCurso.pasoActual && enCurso.pasoActual.transiciones.length > 0 && (
            <form action={accion} method="post" className="space-y-2 border-t border-stone-100 pt-3">
              <input type="hidden" name="accion" value="avanzar" />
              <input type="hidden" name="instanciaId" value={enCurso.id} />
              <label className="block text-xs font-medium text-stone-600">
                Completar «{enCurso.pasoActual.nombre}» — ¿qué sigue?
                <select name="transicionId" required defaultValue="" className="mt-1 block w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm">
                  <option value="" disabled>Elegir…</option>
                  {enCurso.pasoActual.transiciones.map((t) => (
                    <option key={t.id} value={t.id}>{t.etiqueta}</option>
                  ))}
                </select>
              </label>
              <input name="comentario" placeholder="Comentario (opcional)" className="block w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm" />
              <div className="flex flex-wrap items-center gap-2">
                <button className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700">
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden /> Completar paso
                </button>
              </div>
            </form>
          )}

          {puedeOperar && (
            <form action={accion} method="post" className="flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3">
              <input type="hidden" name="accion" value="cancelar" />
              <input type="hidden" name="instanciaId" value={enCurso.id} />
              <label className="text-xs">
                <span className="mb-0.5 block text-stone-500">Cancelar el flujo</span>
                <input name="motivo" placeholder="Motivo" required className="rounded-md border border-stone-300 px-2 py-1 text-sm" />
              </label>
              <button className="rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                Cancelar flujo
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {puedeOperar && aplicables.length > 0 && estado !== "ANULADA" ? (
            <form action={accion} method="post" className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="accion" value="iniciar" />
              <label className="text-sm">
                <span className="mb-0.5 block text-xs text-stone-500">Aplicar un flujo de trabajo</span>
                <select name="flujoId" required defaultValue="" className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm">
                  <option value="" disabled>Elegir flujo…</option>
                  {aplicables.map((f) => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              </label>
              <button className="rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700">Iniciar</button>
            </form>
          ) : (
            <p className="text-xs text-stone-400">
              {aplicables.length === 0 && puedeOperar
                ? "No hay flujos activos para este tipo de comunicación. El administrador los define en Configuración → Flujos de trabajo."
                : "No hay un flujo de trabajo en curso."}
            </p>
          )}
        </div>
      )}

      {historial.length > 0 && (
        <div className="mt-4 space-y-1 border-t border-stone-100 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Flujos anteriores</p>
          {historial.map((h) => (
            <p key={h.id} className="flex items-center gap-1.5 text-xs text-stone-500">
              {h.estado === "COMPLETADO" ? (
                <CheckCircle2 className="h-3.5 w-3.5 flex-none text-emerald-600" aria-hidden />
              ) : (
                <XCircle className="h-3.5 w-3.5 flex-none text-stone-400" aria-hidden />
              )}
              {h.flujo.nombre} — {h.estado === "COMPLETADO" ? "completado" : "cancelado"}
              {h.finalizadoEn ? ` el ${formatearFechaHora(h.finalizadoEn)}` : ""}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
