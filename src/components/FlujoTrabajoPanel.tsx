import { Workflow, CheckCircle2, XCircle, ArrowRight, CircleDot, Clock, AlertTriangle, User } from "lucide-react";
import type { TipoComunicacion } from "@prisma/client";
import {
  flujosAplicables,
  obtenerInstanciasDeComunicacion,
  obtenerInstanciasDeObjeto,
  estadoTerminoPaso,
  describirResponsablePaso,
  puedeCompletarPaso,
  estadoFirmasDeComunicacion,
  ETIQUETA_TIPO_PASO,
  type AmbitoExpedienteFlujo,
  type UsuarioFlujo,
} from "@/lib/flujos";
import { MODULO_APLICATIVO, moduloDeAmbito, RUTA_FLUJOS } from "@/lib/flujos-modulos";
import { db } from "@/lib/db";
import { BuscadorPersona } from "@/components/BuscadorPersona";
import { flujoAMermaid } from "@/lib/flujos-diagrama";
import { Flujograma } from "@/components/Flujograma";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { formatearFecha, formatearFechaHora } from "@/lib/fecha";

export type DestinoFlujo =
  | { ambito: "COMUNICACION"; id: string; tipoComunicacion: TipoComunicacion; habilitado: boolean }
  | { ambito: AmbitoExpedienteFlujo; id: string; habilitado: boolean };

export async function FlujoTrabajoPanel({
  destino,
  accion,
  puedeOperar,
  usuario,
  ancla = "flujo",
}: {
  destino: DestinoFlujo;
  accion: string;
  puedeOperar: boolean;
  usuario: UsuarioFlujo;
  ancla?: string;
}) {
  const modulo = moduloDeAmbito(destino.ambito);
  const esComunicacion = destino.ambito === "COMUNICACION";
  const habilitado = destino.habilitado;
  const [{ comunicacion, instancias }, aplicables, calendario] = await Promise.all([
    destino.ambito === "COMUNICACION" ? obtenerInstanciasDeComunicacion(destino.id) : obtenerInstanciasDeObjeto(destino.ambito, destino.id),
    puedeOperar && habilitado ? flujosAplicables(destino.ambito === "COMUNICACION" ? destino.tipoComunicacion : destino.ambito) : Promise.resolve([]),
    getCalendarioLaboral(),
  ]);
  const enCurso = instancias.find((i) => i.estado === "EN_CURSO");
  const historial = instancias.filter((i) => i !== enCurso);

  const termino =
    enCurso?.pasoActual && comunicacion
      ? estadoTerminoPaso(enCurso.pasoActualDesde, enCurso.pasoActual.slaDiasHabiles, calendario)
      : null;
  const responsable =
    enCurso?.pasoActual && comunicacion ? describirResponsablePaso(enCurso.pasoActual, { ...comunicacion, asignadoA: enCurso.asignadoA }, modulo) : null;
  const ultimaEjecucion = enCurso?.ejecuciones.at(-1);
  const puedeCompletar = Boolean(
    enCurso?.pasoActual &&
      comunicacion &&
      puedeCompletarPaso(
        enCurso.pasoActual,
        {
          asignadoAId: enCurso.asignadoAId,
          responsableAnteriorId: ultimaEjecucion?.responsable?.id ?? enCurso.iniciadoPorId,
          comunicacion,
        },
        usuario
      )
  );
  const esPasoFirma = esComunicacion && enCurso?.pasoActual?.tipo === "FIRMA";
  const firmas = esPasoFirma ? await estadoFirmasDeComunicacion(destino.id) : null;
  const pasosPorId = new Map((enCurso?.flujo.pasos ?? []).map((p) => [p.id, p]));
  const opciones = (enCurso?.pasoActual?.transiciones ?? []).map((t) => {
    const destino = pasosPorId.get(t.haciaPasoId);
    return {
      ...t,
      destino,
      devuelve: Boolean(destino && destino.tipo !== "FIN" && enCurso?.pasoActual && destino.orden < enCurso.pasoActual.orden),
      manual: destino?.asignacion === "MANUAL" && destino.tipo !== "FIN",
    };
  });
  const necesitaPersona = opciones.some((o) => o.manual) || (enCurso?.pasoActual?.asignacion === "MANUAL" && usuario.esAdministrador);
  const personas = necesitaPersona
    ? await db.usuario.findMany({ where: { activo: true, modulosAcceso: { has: MODULO_APLICATIVO[modulo] } }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, dependencia: { select: { nombre: true } } } }).then((l) => l.map((u) => ({ id: u.id, nombre: u.nombre, detalle: u.dependencia?.nombre ?? null })))
    : [];

  return (
    <section id={ancla} className="scroll-mt-4 rounded-2xl border border-stone-200 bg-white shadow-soft p-4">
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

          {enCurso.pasoActual && (
            <div className="rounded-md border border-stone-200 bg-stone-50/70 px-3 py-2 text-xs">
              <p className="flex flex-wrap items-center gap-1.5">
                <CircleDot className="h-3.5 w-3.5 flex-none text-cdmb-600" aria-hidden />
                <strong className="text-stone-900">{enCurso.pasoActual.nombre}</strong>
                <span className="rounded-sm bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">
                  {ETIQUETA_TIPO_PASO[enCurso.pasoActual.tipo]}
                </span>
              </p>
              {responsable && (
                <p className="mt-1 flex items-center gap-1.5 text-stone-500">
                  <User className="h-3 w-3 flex-none" aria-hidden /> Responsable: {responsable}
                </p>
              )}
              {termino && (
                <p
                  className={`mt-1 flex items-center gap-1.5 font-medium ${
                    termino.vencido ? "text-red-600" : termino.diasHabiles <= 1 ? "text-amber-600" : "text-stone-500"
                  }`}
                >
                  {termino.vencido ? <AlertTriangle className="h-3 w-3 flex-none" aria-hidden /> : <Clock className="h-3 w-3 flex-none" aria-hidden />}
                  {termino.vencido
                    ? `Término vencido hace ${termino.diasHabiles} día${termino.diasHabiles === 1 ? "" : "s"} hábil${termino.diasHabiles === 1 ? "" : "es"} (era el ${formatearFecha(termino.limite)})`
                    : `Vence el ${formatearFecha(termino.limite)} (${termino.diasHabiles} día${termino.diasHabiles === 1 ? "" : "s"} hábil${termino.diasHabiles === 1 ? "" : "es"})`}
                </p>
              )}
            </div>
          )}

          {firmas && (
            <p className="rounded-md border border-cdmb-100 bg-cdmb-50 px-3 py-2 text-xs text-cdmb-900">
              {firmas.estado === "SIN_FIRMANTES"
                ? "Paso de firma: asigne los firmantes del documento en la sección de firmas. El flujo avanza solo cuando el documento quede firmado."
                : firmas.estado === "PENDIENTE"
                  ? `Esperando firmas: ${firmas.completadas} de ${firmas.total}. El flujo avanza solo cuando todos firmen; si alguien rechaza, toma la salida de rechazo.`
                  : "Las firmas ya están completas; el flujo avanzará en la próxima actualización."}
            </p>
          )}

          {enCurso.pasoActual?.instrucciones && (
            <p className="rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-600">{enCurso.pasoActual.instrucciones}</p>
          )}

          {enCurso.ejecuciones.length > 0 && (
            <ol className="space-y-1.5 border-t border-stone-100 pt-3">
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
            </ol>
          )}

          {!puedeCompletar && !esPasoFirma && enCurso.pasoActual && enCurso.pasoActual.tipo !== "FIN" && (
            <p className="border-t border-stone-100 pt-3 text-xs text-stone-500">Este paso lo completa {responsable ?? "su responsable"}.</p>
          )}

          {puedeCompletar && (!esPasoFirma || usuario.esAdministrador) && enCurso.pasoActual && enCurso.pasoActual.transiciones.length > 0 && (
            <form action={accion} method="post" className="space-y-2 border-t border-stone-100 pt-3">
              <input type="hidden" name="accion" value="avanzar" />
              <input type="hidden" name="instanciaId" value={enCurso.id} />
              <label className="block text-xs font-medium text-stone-600">
                {esPasoFirma ? `Avanzar manualmente «${enCurso.pasoActual.nombre}» (solo administración)` :`Completar «${enCurso.pasoActual.nombre}» — ¿qué sigue?`}
                <select name="transicionId" required defaultValue="" className="mt-1 block w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm">
                  <option value="" disabled>Elegir…</option>
                  {opciones.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.etiqueta}
                      {t.destino ? ` → ${t.destino.nombre}` : ""}
                      {t.devuelve ? " (devuelve: requiere motivo)" : ""}
                      {t.manual ? " (elija a quién)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {opciones.some((o) => o.manual) && (
                <label className="block text-xs font-medium text-stone-600">
                  Asignar el siguiente paso a (solo si se asigna a mano)
                  <div className="mt-1">
                    <BuscadorPersona name="asignarAId" personas={personas} />
                  </div>
                </label>
              )}
              <input
                name="comentario"
                placeholder={opciones.some((o) => o.devuelve) ? "Comentario (obligatorio si devuelve)" : "Comentario (opcional)"}
                className="block w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-acento-600">
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden /> Completar paso
                </button>
              </div>
            </form>
          )}

          {usuario.esAdministrador && enCurso.pasoActual?.asignacion === "MANUAL" && (
            <form action={accion} method="post" className="flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3">
              <input type="hidden" name="accion" value="reasignar" />
              <input type="hidden" name="instanciaId" value={enCurso.id} />
              <label className="text-xs">
                <span className="mb-0.5 block text-stone-500">Reasignar el paso actual</span>
                <BuscadorPersona name="asignarAId" personas={personas} inicial={enCurso.asignadoAId} requerido />
              </label>
              <button className="rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">Reasignar</button>
            </form>
          )}

          {puedeOperar && (
            <form action={accion} method="post" className="flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3">
              <input type="hidden" name="accion" value="cancelar" />
              <input type="hidden" name="instanciaId" value={enCurso.id} />
              <label className="text-xs">
                <span className="mb-0.5 block text-stone-500">Cancelar el flujo</span>
                <input name="motivo" placeholder="Motivo" required className="rounded-md border border-stone-200 px-2 py-1 text-sm" />
              </label>
              <button className="rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                Cancelar flujo
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {puedeOperar && aplicables.length > 0 && habilitado ? (
            <form action={accion} method="post" className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="accion" value="iniciar" />
              <label className="text-sm">
                <span className="mb-0.5 block text-xs text-stone-500">Aplicar un flujo de trabajo</span>
                <select name="flujoId" required defaultValue="" className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-sm">
                  <option value="" disabled>Elegir flujo…</option>
                  {aplicables.map((f) => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              </label>
              <button className="rounded-md bg-acento-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-acento-600">Iniciar</button>
            </form>
          ) : (
            <p className="text-xs text-stone-400">
              {aplicables.length === 0 && puedeOperar && habilitado ? (
                <>
                  No hay flujos activos para este tipo de {esComunicacion ? "comunicación" : "expediente"}.{" "}
                  {usuario.esAdministrador ? (
                    <a href={RUTA_FLUJOS[modulo]} className="font-medium text-cdmb-700 hover:underline">
                      Definir flujos de trabajo
                    </a>
                  ) : (
                    "El administrador del módulo los define."
                  )}
                </>
              ) : (
                "No hay un flujo de trabajo en curso."
              )}
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
