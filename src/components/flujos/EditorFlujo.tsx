import type { ReactNode } from "react";
import type { AmbitoFlujo } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2, AlertTriangle, ArrowRight, PlayCircle, Flag, XCircle, Timer, Info } from "lucide-react";
import { obtenerFlujo, versionesDeFlujo, ETIQUETA_TIPO_PASO } from "@/lib/flujos";
import { indicadoresDeFlujo } from "@/lib/flujos-indicadores";
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
import { PestanasDetalle } from "@/components/sgdea/PestanasDetalle";
import { Chip, Indicador } from "@/components/tablero";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { db } from "@/lib/db";
import { Field, SectionHelp } from "@/components/Field";

const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";
const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500";
const td = "px-3 py-2 align-top";

const OPERADORES_POR_DEFECTO: Record<ModuloFlujo, string> = {
  SGDEA: "Sin nada marcado: cualquier funcionario con permiso de distribución o que gestione el expediente.",
  GECON: "Sin nada marcado: el administrador o jefe de contratación y el personal asignado al expediente.",
  TRAMITES: "Sin nada marcado: quien tenga permiso de edición sobre el trámite.",
};

const INICIO_AUTOMATICO: Record<AmbitoFlujo, string> = {
  COMUNICACION: "Iniciar automáticamente al radicar",
  EXPEDIENTE: "Iniciar automáticamente al abrir un expediente documental",
  CONTRATO: "Iniciar automáticamente al crear un expediente contractual",
  TRAMITE: "Iniciar automáticamente al radicar un expediente de trámite",
};

const dias = (n: number) => `${n.toLocaleString("es-CO")} d. hábil${n === 1 ? "" : "es"}`;

export async function EditorFlujo({ id, modulo, ok, error, pestana }: { id: string; modulo: ModuloFlujo; ok?: string; error?: string; pestana?: string }) {
  const [flujo, dependencias, cargos, calendario] = await Promise.all([
    obtenerFlujo(id),
    listarDependenciasActivas(),
    db.cargo.findMany({ orderBy: { orden: "asc" }, select: { nombre: true } }),
    getCalendarioLaboral(),
  ]);
  if (!flujo) notFound();
  const moduloFlujo = moduloDeAmbito(flujo.ambito);
  if (moduloFlujo !== modulo) redirect(`${RUTA_FLUJOS[moduloFlujo]}/${flujo.id}`);
  const [versiones, uso] = await Promise.all([versionesDeFlujo(flujo), indicadoresDeFlujo(flujo.id, calendario)]);

  const accion = `/api/flujos/${flujo.id}`;
  const nombrePorId = new Map(flujo.pasos.map((p) => [p.id, `${p.orden}. ${p.nombre}`]));
  const opcionesAplicaA = Object.entries(OPCIONES_APLICA_A[modulo]);
  const tiposPaso = TIPOS_PASO_DE_MODULO[modulo];
  const asignaciones = ASIGNACIONES_DE_MODULO[modulo];

  const diagrama = (
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
  );

  const pasos = (
    <div className="space-y-3">
      {flujo.pasos.map((paso, idx) => (
        <details key={paso.id} id={`paso-${paso.id}`} className="group rounded-md border border-stone-200 bg-white">
          <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium text-stone-800">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-cdmb-100 text-xs font-semibold text-cdmb-700">{paso.orden}</span>
                {paso.nombre}
                <Chip>{ETIQUETA_TIPO_PASO[paso.tipo]}</Chip>
                {paso.transiciones.length === 0 && paso.tipo !== "FIN" && <Chip tono="ambar">Sin salidas</Chip>}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {etiquetaAsignacion(paso.asignacion, modulo)}
                {paso.asignacion === "DEPENDENCIA_FIJA" && paso.dependencia ? ` — ${paso.dependencia.nombre}` : ""}
                {paso.asignacion === "CARGO" && paso.cargoClave ? ` — ${paso.cargoClave}` : ""}
                {paso.slaDiasHabiles ? ` · término ${dias(paso.slaDiasHabiles)}` : ""}
                {paso.slaDiasHabiles && paso.tipo !== "FIN"
                  ? paso.alVencer === "AVANZAR" && paso.salidaVencimiento
                    ? ` · al vencer avanza por «${paso.salidaVencimiento}»`
                    : paso.alVencer === "NINGUNA"
                      ? " · al vencer no se marca"
                      : " · al vencer se marca"
                  : ""}
              </p>
              {paso.transiciones.length > 0 && (
                <p className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                  {paso.transiciones.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-1 rounded-sm bg-cdmb-50 px-1.5 py-0.5 font-medium text-cdmb-800">
                      {t.etiqueta} <ArrowRight className="h-3 w-3" aria-hidden /> {nombrePorId.get(t.haciaPasoId) ?? "?"}
                    </span>
                  ))}
                </p>
              )}
            </div>
            <span className="text-xs font-medium text-cdmb-700 group-open:hidden">Editar</span>
            <span className="hidden text-xs font-medium text-stone-500 group-open:inline">Cerrar</span>
          </summary>

          <div className="space-y-3 border-t border-stone-100 px-4 py-3">
            <div className="flex flex-wrap items-center gap-1">
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

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-stone-700">Salidas</p>
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

            <form action={accion} method="post" className="grid grid-cols-1 gap-3 border-t border-stone-100 pt-3 sm:grid-cols-3">
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
          </div>
        </details>
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
        <button
          title="Entra antes del paso «Fin» si el último lo es."
          className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-2 text-sm font-medium text-white hover:bg-acento-600"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden /> Agregar paso
        </button>
      </form>
    </div>
  );

  const datos = (
    <div className="space-y-4">
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
          <label
            className="flex items-start gap-2 text-sm text-stone-700 sm:col-span-3"
            title={
              flujo.ambito === "COMUNICACION"
                ? "Mientras esté activo, se aplica a cada comunicación nueva del tipo indicado en «Aplica a». Solo un flujo automático activo por tipo."
                : "Mientras esté activo, se aplica a cada expediente nuevo del módulo. Solo un flujo automático activo por módulo."
            }
          >
            <input type="checkbox" name="inicioAutomatico" defaultChecked={flujo.inicioAutomatico} className="mt-0.5 rounded border-stone-300" />
            <span>{INICIO_AUTOMATICO[flujo.ambito]}</span>
          </label>
          <div className="sm:col-span-3">
            <button className="rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600">Guardar datos</button>
          </div>
        </form>
      </div>

      <form action={accion} method="post" className="rounded-md border border-stone-200 bg-white p-4">
        <input type="hidden" name="accion" value="accesos" />
        <p className="flex items-center gap-1 text-sm font-semibold text-stone-900">
          Dependencias que pueden iniciar este flujo
          <span title={OPERADORES_POR_DEFECTO[modulo]} className="cursor-help text-xs font-normal text-stone-400">
            ({flujo.dependenciasOperadoras.length === 0 ? "todas las habilitadas" : `${flujo.dependenciasOperadoras.length} elegidas`})
          </span>
        </p>
        <div className="mt-2 grid max-h-64 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto sm:grid-cols-3">
          {dependencias.map((d) => (
            <label key={d.id} className="flex items-center gap-1.5 text-xs text-stone-700">
              <input type="checkbox" name="dependenciaId" value={d.id} defaultChecked={flujo.dependenciasOperadoras.includes(d.id)} className="rounded border-stone-200" />
              {d.nombre}
            </label>
          ))}
        </div>
        <button className="mt-3 rounded-md border border-menu-500 bg-white px-3 py-1.5 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50">Guardar acceso</button>
      </form>
    </div>
  );

  const listaVersiones = (
    <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
      <table className="w-full text-xs">
        <thead className="border-b border-stone-200 bg-stone-50">
          <tr>
            <th className={th}>Versión</th>
            <th className={th}>Estado</th>
            <th className={`${th} text-right`}>Aplicaciones</th>
            <th className={th}>Creada</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {versiones.map((v) => (
            <tr key={v.id} className={v.id === flujo.id ? "bg-stone-50" : ""}>
              <td className={td}>
                {v.id === flujo.id ? (
                  <span className="font-semibold text-stone-900">Versión {v.version} (la que está viendo)</span>
                ) : (
                  <Link href={`${RUTA_FLUJOS[modulo]}/${v.id}`} className="font-medium text-cdmb-700 hover:underline">
                    Versión {v.version}
                  </Link>
                )}
              </td>
              <td className={td}>
                <Chip tono={v.activo ? "verde" : "neutro"}>{v.activo ? "Vigente" : "Inactiva"}</Chip>
              </td>
              <td className={`${td} text-right tabular-nums`}>{v._count.instancias}</td>
              <td className={`${td} text-stone-500`}>{formatearFecha(v.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const indicadores = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Indicador icon={PlayCircle} valor={uso.porEstado.EN_CURSO} etiqueta="En curso" tono="cielo" />
        <Indicador icon={AlertTriangle} valor={uso.vencidos} etiqueta="Con paso vencido" tono="ambar" alerta={uso.vencidos > 0} />
        <Indicador icon={Flag} valor={uso.porEstado.COMPLETADO} etiqueta="Completados" tono="verde" />
        <Indicador icon={XCircle} valor={uso.porEstado.CANCELADO} etiqueta="Cancelados" tono="neutro" />
        <Indicador icon={Timer} valor={uso.duracionPromedio ?? "—"} etiqueta="Duración promedio" detalle="días hábiles, completados" tono="cdmb" />
      </div>

      <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
        <p className="flex items-center gap-1 border-b border-stone-100 px-4 py-2 text-sm font-semibold text-stone-900">
          Tiempo por paso
          <span
            title="Días hábiles desde que el flujo llegó al paso hasta que se completó. «Veces» mayor que las aplicaciones indica devoluciones. Solo cuenta esta versión."
            className="inline-flex cursor-help text-stone-400 hover:text-cdmb-600"
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </span>
        </p>
        <table className="w-full text-xs">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className={th}>Paso</th>
              <th className={`${th} text-right`}>Veces</th>
              <th className={`${th} text-right`}>Promedio</th>
              <th className={`${th} text-right`}>Máximo</th>
              <th className={`${th} text-right`}>Término</th>
              <th className={`${th} text-right`}>Fuera de término</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {uso.pasos.map((p) => (
              <tr key={p.id}>
                <td className={td}>
                  {p.orden}. {p.nombre}
                </td>
                <td className={`${td} text-right tabular-nums`}>{p.tiempo?.veces ?? 0}</td>
                <td className={`${td} text-right tabular-nums`}>{p.tiempo ? p.tiempo.promedioDias.toLocaleString("es-CO") : "—"}</td>
                <td className={`${td} text-right tabular-nums`}>{p.tiempo ? p.tiempo.maximoDias : "—"}</td>
                <td className={`${td} text-right tabular-nums text-stone-500`}>{p.slaDiasHabiles ?? "—"}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {p.tiempo?.fueraDeTermino ? <span className="font-semibold text-red-600">{p.tiempo.fueraDeTermino}</span> : <span className="text-stone-300">0</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
        <p className="border-b border-stone-100 px-4 py-2 text-sm font-semibold text-stone-900">En curso ({uso.enCurso.length})</p>
        {uso.enCurso.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-stone-400">Ninguna aplicación en curso de esta versión.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr>
                <th className={th}>Expediente</th>
                <th className={th}>Paso actual</th>
                <th className={th}>Desde</th>
                <th className={th}>Término</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {uso.enCurso.map((i) => (
                <tr key={i.id}>
                  <td className={td}>
                    <Link href={i.objetivo.href} className="font-medium text-cdmb-700 hover:underline">
                      {i.objetivo.etiqueta}
                    </Link>
                    <span className="block max-w-xs truncate text-stone-400">{i.objetivo.asunto}</span>
                  </td>
                  <td className={td}>{i.paso}</td>
                  <td className={`${td} text-stone-500`}>{i.desde ? formatearFecha(i.desde) : "—"}</td>
                  <td className={td}>
                    {i.termino ? (
                      <span className={i.termino.vencido ? "font-medium text-red-600" : i.termino.diasHabiles <= 1 ? "font-medium text-amber-600" : "text-stone-500"}>
                        {i.termino.vencido ? `Vencido hace ${dias(i.termino.diasHabiles)}` : `Vence el ${formatearFecha(i.termino.limite)}`}
                      </span>
                    ) : (
                      <span className="text-stone-300">Sin término</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</div>}
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Link href={RUTA_FLUJOS[modulo]} className="inline-flex items-center gap-1.5 text-sm font-medium text-cdmb-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Todos los flujos
      </Link>

      <div className="rounded-md border border-stone-200 bg-white px-5 py-4">
        <SectionHelp>
          El <strong>paso 1</strong> es siempre el inicial. Cada paso (salvo los de tipo «Fin») necesita al menos una <strong>salida</strong> hacia otro paso. Se activa
          solo cuando la estructura no tiene errores. Si el flujo ya se aplicó, para cambiar sus pasos sin afectar los expedientes en curso cree una nueva versión: al
          activarla queda como vigente y los flujos en curso terminan con la versión con la que empezaron.
        </SectionHelp>
        <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-stone-900">
          {flujo.nombre}
          {versiones.length > 1 && <Chip tono="cdmb">Versión {flujo.version}</Chip>}
          <Chip tono={flujo.activo ? "verde" : "neutro"}>{flujo.activo ? "Vigente" : "Inactivo"}</Chip>
          {flujo.inicioAutomatico && <Chip tono="cielo">Automático</Chip>}
        </h2>
        <p className="mt-0.5 text-xs text-stone-500">
          {flujo.pasos.length} paso{flujo.pasos.length === 1 ? "" : "s"} · {flujo._count.instancias} {flujo._count.instancias === 1 ? "aplicación" : "aplicaciones"}
          {flujo.descripcion ? ` · ${flujo.descripcion}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
          <a href={`/api/flujos/${flujo.id}/bpmn`} className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Descargar BPMN
          </a>
          {flujo._count.instancias === 0 && (
            <FormBoton accion={accion} name="accion" value="eliminar" className="border border-red-200 bg-white text-red-700 hover:bg-red-50">
              Eliminar flujo
            </FormBoton>
          )}
        </div>
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

      <PestanasDetalle
        etiqueta="Secciones del flujo"
        inicial={pestana}
        grupos={[
          { id: "diagrama", label: "Diagrama", contenido: diagrama },
          { id: "pasos", label: "Pasos", contador: flujo.pasos.length, contenido: pasos },
          { id: "datos", label: "Datos y acceso", contenido: datos },
          { id: "uso", label: "Uso e indicadores", contador: uso.porEstado.EN_CURSO, contenido: indicadores },
          { id: "versiones", label: "Versiones", contador: versiones.length, oculta: versiones.length < 2, contenido: listaVersiones },
        ]}
      />
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
      <button disabled={disabled} className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${className}`}>
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
