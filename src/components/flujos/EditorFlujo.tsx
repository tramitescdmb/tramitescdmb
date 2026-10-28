import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2, AlertTriangle, ArrowRight } from "lucide-react";
import { obtenerFlujo, versionesDeFlujo, ETIQUETA_TIPO_PASO } from "@/lib/flujos";
import { formatearFecha } from "@/lib/fecha";
import {
  ASIGNACIONES_DE_MODULO,
  etiquetaAsignacion,
  moduloDeAmbito,
  OPCIONES_APLICA_A,
  RUTA_FLUJOS,
  TIPOS_PASO_DE_MODULO,
  valorAplicaA,
  type ModuloFlujo,
} from "@/lib/flujos-modulos";
import { FlujoLienzo } from "@/components/FlujoLienzoLazy";
import { FlujoSimulador } from "@/components/FlujoSimulador";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { db } from "@/lib/db";
import { Field, SectionHelp } from "@/components/Field";

const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";

const OPERADORES_POR_DEFECTO: Record<ModuloFlujo, string> = {
  SGDEA: "Sin nada marcado: cualquier funcionario con permiso de distribución o que gestione el expediente.",
  GECON: "Sin nada marcado: el administrador o jefe de contratación y el personal asignado al expediente.",
  TRAMITES: "Sin nada marcado: quien tenga permiso de edición sobre el trámite.",
};

export async function EditorFlujo({ id, modulo, ok, error }: { id: string; modulo: ModuloFlujo; ok?: string; error?: string }) {
  const [flujo, dependencias, cargos, calendario] = await Promise.all([
    obtenerFlujo(id),
    listarDependenciasActivas(),
    db.cargo.findMany({ orderBy: { orden: "asc" }, select: { nombre: true } }),
    getCalendarioLaboral(),
  ]);
  if (!flujo) notFound();
  const moduloFlujo = moduloDeAmbito(flujo.ambito);
  if (moduloFlujo !== modulo) redirect(`${RUTA_FLUJOS[moduloFlujo]}/${flujo.id}`);
  const versiones = await versionesDeFlujo(flujo);

  const accion = `/api/flujos/${flujo.id}`;
  const nombrePorId = new Map(flujo.pasos.map((p) => [p.id, `${p.orden}. ${p.nombre}`]));
  const opcionesAplicaA = Object.entries(OPCIONES_APLICA_A[modulo]);
  const tiposPaso = TIPOS_PASO_DE_MODULO[modulo];
  const asignaciones = ASIGNACIONES_DE_MODULO[modulo];

  return (
    <div className="space-y-5">
      {ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</div>}
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Link href={RUTA_FLUJOS[modulo]} className="inline-flex items-center gap-1.5 text-sm font-medium text-cdmb-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Todos los flujos
      </Link>

      <div className="space-y-2">
        <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-stone-900">
          {flujo.nombre}
          {versiones.length > 1 && <span className="rounded-sm bg-cdmb-50 px-2 py-0.5 text-[11px] font-medium text-cdmb-700">Versión {flujo.version}</span>}
          <span className={`rounded-sm px-2 py-0.5 text-[11px] font-medium ${flujo.activo ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
            {flujo.activo ? "Vigente" : "Inactivo"}
          </span>
        </h2>
        {flujo._count.instancias > 0 && (
          <p className="rounded-md border border-cdmb-100 bg-cdmb-50/60 px-3 py-2 text-xs text-cdmb-900">
            Este flujo ya se aplicó {flujo._count.instancias} vez(es). Para cambiar sus pasos sin afectar los expedientes en curso, cree una nueva versión: al activarla
            queda como vigente y los flujos en curso terminan con la versión con la que empezaron.
          </p>
        )}
        <SectionHelp>
          El <strong>paso 1</strong> es siempre el inicial. Cada paso (salvo los de tipo «Fin») necesita al menos una <strong>salida</strong> hacia otro paso. Se
          activa solo cuando la estructura no tiene errores.
        </SectionHelp>
      </div>

      {flujo.problemas.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" aria-hidden /> Revise antes de activar:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-6">
            {flujo.problemas.map((p, i) => (
              <li key={i}>
                {p.paso ? <strong>{p.paso}: </strong> : null}
                {p.mensaje}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-stone-900">Diagrama del flujo (editor visual)</h3>
          <FlujoSimulador
            pasos={flujo.pasos.map((p) => ({ id: p.id, orden: p.orden, nombre: p.nombre, tipo: p.tipo, slaDiasHabiles: p.slaDiasHabiles }))}
            transiciones={flujo.pasos.flatMap((p) => p.transiciones.map((t) => ({ desdePasoId: t.desdePasoId, haciaPasoId: t.haciaPasoId, etiqueta: t.etiqueta })))}
            calendario={{ diasNoLaborables: [...(calendario.diasNoLaborables ?? [])], diasSemana: calendario.diasSemana }}
          />
        </div>
        <FlujoLienzo
          flujoId={flujo.id}
          tipos={tiposPaso}
          pasos={flujo.pasos.map((p) => ({ id: p.id, orden: p.orden, nombre: p.nombre, tipo: p.tipo, posX: p.posX, posY: p.posY }))}
          transiciones={flujo.pasos.flatMap((p) => p.transiciones.map((t) => ({ id: t.id, desdePasoId: t.desdePasoId, haciaPasoId: t.haciaPasoId, etiqueta: t.etiqueta })))}
        />
      </div>

      <div className="space-y-3 rounded-md border border-stone-200 bg-white p-4">
        <form action={accion} method="post" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input type="hidden" name="accion" value="editar" />
          <div className={opcionesAplicaA.length > 1 ? "sm:col-span-2" : "sm:col-span-3"}>
            <Field label="Nombre" required>
              <input name="nombre" defaultValue={flujo.nombre} className={inputCls} required />
            </Field>
          </div>
          {opcionesAplicaA.length > 1 ? (
            <Field label="Aplica a">
              <select name="aplicaA" className={inputCls} defaultValue={valorAplicaA(flujo)}>
                {opcionesAplicaA.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <input type="hidden" name="aplicaA" value={valorAplicaA(flujo)} />
          )}
          <div className="sm:col-span-3">
            <Field label="Descripción">
              <input name="descripcion" defaultValue={flujo.descripcion ?? ""} className={inputCls} />
            </Field>
          </div>
          {flujo.ambito === "COMUNICACION" && (
            <label className="flex items-start gap-2 text-sm text-stone-700 sm:col-span-3">
              <input type="checkbox" name="inicioAutomatico" defaultChecked={flujo.inicioAutomatico} className="mt-0.5 rounded border-stone-300" />
              <span>
                Iniciar automáticamente al radicar
                <span className="block text-xs text-stone-500">
                  Mientras esté activo, se aplica solo a cada comunicación nueva del tipo indicado en «Aplica a». Solo puede haber un flujo automático activo por tipo.
                </span>
              </span>
            </label>
          )}
          <div className="sm:col-span-3">
            <button className="rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600">Guardar datos</button>
          </div>
        </form>
        <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3">
          <FormBoton
            accion={accion}
            name="accion"
            value={flujo.activo ? "desactivar" : "activar"}
            disabled={!flujo.activo && flujo.problemas.length > 0}
            className={flujo.activo ? "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50" : "bg-emerald-600 text-white hover:bg-emerald-700"}
          >
            {flujo.activo ? "Desactivar" : "Activar flujo"}
          </FormBoton>
          <FormBoton accion={accion} name="accion" value="nueva-version" className="border border-menu-500 bg-white text-cdmb-700 hover:bg-cdmb-50">
            Nueva versión
          </FormBoton>
          <FormBoton accion={accion} name="accion" value="duplicar" className="border border-stone-200 bg-white text-stone-700 hover:bg-stone-50">
            Duplicar como flujo nuevo
          </FormBoton>
          <a href={`/api/flujos/${flujo.id}/bpmn`} className="rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Descargar BPMN
          </a>
          {flujo._count.instancias === 0 && (
            <FormBoton accion={accion} name="accion" value="eliminar" className="border border-red-200 bg-white text-red-700 hover:bg-red-50">
              Eliminar flujo
            </FormBoton>
          )}
        </div>
      </div>

      {versiones.length > 1 && (
        <div className="rounded-md border border-stone-200 bg-white">
          <p className="border-b border-stone-100 px-4 py-2 text-sm font-semibold text-stone-900">Versiones de este flujo</p>
          <ul className="divide-y divide-stone-100 text-xs">
            {versiones.map((v) => (
              <li key={v.id} className={`flex flex-wrap items-center gap-3 px-4 py-2 ${v.id === flujo.id ? "bg-stone-50" : ""}`}>
                {v.id === flujo.id ? (
                  <span className="font-semibold text-stone-900">Versión {v.version} (la que está viendo)</span>
                ) : (
                  <Link href={`${RUTA_FLUJOS[modulo]}/${v.id}`} className="font-medium text-cdmb-700 hover:underline">
                    Versión {v.version}
                  </Link>
                )}
                <span className={v.activo ? "font-medium text-emerald-700" : "text-stone-400"}>{v.activo ? "Vigente" : "Inactiva"}</span>
                <span className="text-stone-500">
                  {v._count.instancias} aplicación{v._count.instancias === 1 ? "" : "es"} · creada el {formatearFecha(v.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={accion} method="post" className="rounded-md border border-stone-200 bg-white p-4">
        <input type="hidden" name="accion" value="accesos" />
        <p className="text-sm font-semibold text-stone-900">Dependencias que pueden iniciar este flujo</p>
        <p className="mt-0.5 text-xs text-stone-500">{OPERADORES_POR_DEFECTO[modulo]}</p>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {dependencias.map((d) => (
            <label key={d.id} className="flex items-center gap-1.5 text-xs text-stone-700">
              <input type="checkbox" name="dependenciaId" value={d.id} defaultChecked={flujo.dependenciasOperadoras.includes(d.id)} className="rounded border-stone-200" />
              {d.nombre}
            </label>
          ))}
        </div>
        <button className="mt-3 rounded-md border border-menu-500 bg-white px-3 py-1.5 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50">Guardar acceso</button>
      </form>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-stone-900">Pasos ({flujo.pasos.length})</h3>
        {flujo.pasos.map((paso, idx) => (
          <div key={paso.id} className="rounded-md border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-medium text-stone-800">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-cdmb-100 text-xs font-semibold text-cdmb-700">{paso.orden}</span>
                  {paso.nombre}
                  <span className="rounded-sm bg-stone-100 px-2 py-0.5 text-[11px] font-normal text-stone-500">{ETIQUETA_TIPO_PASO[paso.tipo]}</span>
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Responsable: {etiquetaAsignacion(paso.asignacion, modulo)}
                  {paso.asignacion === "DEPENDENCIA_FIJA" && paso.dependencia ? ` — ${paso.dependencia.nombre}` : ""}
                  {paso.asignacion === "CARGO" && paso.cargoClave ? ` — ${paso.cargoClave}` : ""}
                  {paso.slaDiasHabiles ? ` · término sugerido ${paso.slaDiasHabiles} días hábiles` : ""}
                  {paso.slaDiasHabiles && paso.tipo !== "FIN"
                    ? paso.alVencer === "AVANZAR" && paso.salidaVencimiento
                      ? ` · al vencer avanza solo por «${paso.salidaVencimiento}»`
                      : paso.alVencer === "NINGUNA"
                        ? " · al vencer no se marca"
                        : " · al vencer se marca como vencido"
                    : ""}
                </p>
              </div>
              <div className="flex flex-none items-center gap-1">
                {idx > 0 && (
                  <FormIcono accion={accion} fields={{ accion: "mover-paso", pasoId: paso.id, direccion: "arriba" }} label="Subir">
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </FormIcono>
                )}
                {idx < flujo.pasos.length - 1 && (
                  <FormIcono accion={accion} fields={{ accion: "mover-paso", pasoId: paso.id, direccion: "abajo" }} label="Bajar">
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </FormIcono>
                )}
                {flujo.pasos.length > 1 && (
                  <FormIcono accion={accion} fields={{ accion: "eliminar-paso", pasoId: paso.id }} label="Eliminar paso" peligro>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </FormIcono>
                )}
              </div>
            </div>

            {paso.instrucciones && <p className="mt-2 rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-600">{paso.instrucciones}</p>}

            <div className="mt-3 space-y-1.5">
              {paso.transiciones.length === 0 && paso.tipo !== "FIN" && <p className="text-xs text-amber-700">Sin salidas — agregue al menos una.</p>}
              {paso.transiciones.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-md bg-cdmb-50 px-2 py-1 font-medium text-cdmb-800">
                    {t.etiqueta} <ArrowRight className="h-3 w-3" aria-hidden /> {nombrePorId.get(t.haciaPasoId) ?? "?"}
                  </span>
                  <FormIcono accion={accion} fields={{ accion: "eliminar-transicion", transicionId: t.id }} label="Quitar salida" peligro small>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </FormIcono>
                </div>
              ))}
              {paso.tipo !== "FIN" && flujo.pasos.length > 1 && (
                <form action={accion} method="post" className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="accion" value="agregar-transicion" />
                  <input type="hidden" name="desdePasoId" value={paso.id} />
                  <label className="text-xs">
                    <span className="mb-0.5 block text-stone-500">Opción</span>
                    <input name="etiqueta" placeholder="Continuar / Aprobar / Devolver…" className="rounded-md border border-stone-200 px-2 py-1 text-sm" required />
                  </label>
                  <label className="text-xs">
                    <span className="mb-0.5 block text-stone-500">Va al paso</span>
                    <select name="haciaPasoId" className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm" required defaultValue="">
                      <option value="" disabled>
                        Elegir…
                      </option>
                      {flujo.pasos
                        .filter((x) => x.id !== paso.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.orden}. {x.nombre}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button className="rounded-md border border-menu-500 bg-white px-2.5 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50">+ Salida</button>
                </form>
              )}
            </div>

            <details className="mt-3 border-t border-stone-100 pt-3">
              <summary className="cursor-pointer text-xs font-medium text-cdmb-700">Editar este paso</summary>
              <form action={accion} method="post" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input type="hidden" name="accion" value="editar-paso" />
                <input type="hidden" name="pasoId" value={paso.id} />
                <div className="sm:col-span-2">
                  <Field label="Nombre" required>
                    <input name="nombre" defaultValue={paso.nombre} className={inputCls} required />
                  </Field>
                </div>
                <Field label="Tipo">
                  <select name="tipo" defaultValue={paso.tipo} className={inputCls}>
                    {tiposPaso.map((t) => (
                      <option key={t} value={t}>
                        {ETIQUETA_TIPO_PASO[t]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Responsable" help="Quién debe completar el paso cuando el flujo llega aquí.">
                  <select name="asignacion" defaultValue={paso.asignacion} className={inputCls}>
                    {asignaciones.map((a) => (
                      <option key={a} value={a}>
                        {etiquetaAsignacion(a, modulo)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Dependencia fija" help="Solo si el responsable es «una dependencia fija».">
                  <select name="dependenciaId" defaultValue={paso.dependenciaId ?? ""} className={inputCls}>
                    <option value="">—</option>
                    {dependencias.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cargo" help="Solo si el responsable es «un cargo»: lo completa cualquier persona con ese cargo.">
                  <select name="cargoClave" defaultValue={paso.cargoClave ?? ""} className={inputCls}>
                    <option value="">—</option>
                    {paso.cargoClave && !cargos.some((c) => c.nombre === paso.cargoClave) && <option value={paso.cargoClave}>{paso.cargoClave} (no está en el catálogo)</option>}
                    {cargos.map((c) => (
                      <option key={c.nombre} value={c.nombre}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Término sugerido (días hábiles)">
                  <input name="slaDiasHabiles" type="number" min={1} defaultValue={paso.slaDiasHabiles ?? ""} className={inputCls} />
                </Field>
                <Field label="Al vencer el término" help="Lo ejecuta el proceso automático diario. Solo aplica si el paso tiene término.">
                  <select name="alVencer" defaultValue={paso.alVencer} className={inputCls}>
                    <option value="AVISAR">Marcar como vencido para su responsable</option>
                    <option value="AVANZAR">Avanzar automáticamente por una salida</option>
                    <option value="NINGUNA">No hacer nada</option>
                  </select>
                </Field>
                <Field label="Salida al vencer" help="Solo si avanza automáticamente.">
                  <select name="salidaVencimiento" defaultValue={paso.salidaVencimiento ?? ""} className={inputCls}>
                    <option value="">—</option>
                    {paso.transiciones.map((t) => (
                      <option key={t.id} value={t.etiqueta}>
                        {t.etiqueta} → {nombrePorId.get(t.haciaPasoId) ?? "?"}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-3">
                  <Field label="Instrucciones para el responsable">
                    <textarea name="instrucciones" defaultValue={paso.instrucciones ?? ""} rows={2} className={inputCls} />
                  </Field>
                </div>
                <div className="sm:col-span-3">
                  <button className="rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600">Guardar paso</button>
                </div>
              </form>
            </details>
          </div>
        ))}

        <form action={accion} method="post" className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-stone-200 bg-stone-50/60 p-4">
          <input type="hidden" name="accion" value="agregar-paso" />
          <label className="text-sm">
            <span className="mb-0.5 block text-xs text-stone-500">Nuevo paso</span>
            <input name="nombre" placeholder="Nombre del paso" className="rounded-md border border-stone-200 px-3 py-2 text-sm" required />
          </label>
          <label className="text-sm">
            <span className="mb-0.5 block text-xs text-stone-500">Tipo</span>
            <select name="tipo" defaultValue="TAREA" className="rounded-md border border-stone-200 bg-white px-2 py-2 text-sm">
              {tiposPaso.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO_PASO[t]}
                </option>
              ))}
            </select>
          </label>
          <button className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-2 text-sm font-medium text-white hover:bg-acento-600">
            <Plus className="h-3.5 w-3.5" aria-hidden /> Agregar paso
          </button>
          <span className="text-xs text-stone-400">Entra antes del paso «Fin» si el último lo es.</span>
        </form>
      </div>
    </div>
  );
}

function FormBoton({
  accion,
  name,
  value,
  children,
  className = "",
  disabled = false,
}: {
  accion: string;
  name: string;
  value: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <form action={accion} method="post">
      <input type="hidden" name={name} value={value} />
      <button disabled={disabled} className={`rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${className}`}>
        {children}
      </button>
    </form>
  );
}

function FormIcono({
  accion,
  fields,
  label,
  children,
  peligro = false,
  small = false,
}: {
  accion: string;
  fields: Record<string, string>;
  label: string;
  children: ReactNode;
  peligro?: boolean;
  small?: boolean;
}) {
  return (
    <form action={accion} method="post" className="inline">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        aria-label={label}
        title={label}
        className={`inline-flex items-center justify-center rounded-md border ${small ? "p-1" : "p-1.5"} ${
          peligro ? "border-red-200 text-red-600 hover:bg-red-50" : "border-stone-200 text-stone-500 hover:bg-stone-50"
        }`}
      >
        {children}
      </button>
    </form>
  );
}
