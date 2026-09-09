import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2, AlertTriangle, ArrowRight } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario } from "@/lib/permisos";
import { obtenerFlujo, puedeAdministrarFlujos, ETIQUETA_TIPO_PASO, ETIQUETA_ASIGNACION, ETIQUETA_APLICA_A } from "@/lib/flujos";
import { FlujoLienzo } from "@/components/FlujoLienzoLazy";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { registrarAccesoDenegadoSeccion } from "@/lib/auditoria-doc";
import { Field, SectionHelp } from "@/components/Field";
import { TituloSeccion } from "@/components/sgdea/ui";

const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";
const TIPOS_PASO = ["TAREA", "REVISION", "DECISION", "FIN"] as const;
const ASIGNACIONES = ["DEPENDENCIA_COMUNICACION", "DEPENDENCIA_FIJA", "CARGO", "RADICADOR", "RESPONSABLE_PASO_ANTERIOR", "MANUAL"] as const;

export default async function FlujoEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarFlujos(permisos)) {
    await registrarAccesoDenegadoSeccion("Flujos de trabajo", session, await headers());
    redirect("/correspondencia");
  }

  const sp = await searchParams;
  const [flujo, dependencias] = await Promise.all([obtenerFlujo(id), listarDependenciasActivas()]);
  if (!flujo) notFound();

  const accion = "/api/correspondencia/flujos/" + flujo.id;
  const nombrePorId = new Map(flujo.pasos.map((p) => [p.id, `${p.orden}. ${p.nombre}`]));

  return (
    <div className="space-y-6">
      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <Link href="/correspondencia/admin/flujos" className="inline-flex items-center gap-1.5 text-sm font-medium text-cdmb-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Todos los flujos
      </Link>

      <div className="space-y-2">
        <TituloSeccion>
          {flujo.nombre}
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${flujo.activo ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
            {flujo.activo ? "Activo" : "Inactivo"}
          </span>
        </TituloSeccion>
        <SectionHelp>
          El <strong>paso 1</strong> es siempre el inicial. Cada paso (salvo los de tipo «Fin») necesita al menos
          una <strong>salida</strong> hacia otro paso. Se activa solo cuando la estructura no tiene errores.
        </SectionHelp>
      </div>

      {flujo.problemas.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" aria-hidden /> Revise antes de activar:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-6">
            {flujo.problemas.map((p, i) => (
              <li key={i}>{p.paso ? <strong>{p.paso}: </strong> : null}{p.mensaje}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Lienzo — editor visual del flujo */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-stone-900">Diagrama del flujo (editor visual)</h3>
        <FlujoLienzo
          flujoId={flujo.id}
          pasos={flujo.pasos.map((p) => ({ id: p.id, orden: p.orden, nombre: p.nombre, tipo: p.tipo, posX: p.posX, posY: p.posY }))}
          transiciones={flujo.pasos.flatMap((p) =>
            p.transiciones.map((t) => ({ id: t.id, desdePasoId: t.desdePasoId, haciaPasoId: t.haciaPasoId, etiqueta: t.etiqueta })),
          )}
        />
      </div>

      {/* Datos del flujo */}
      <form action={accion} method="post" className="grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-3">
        <input type="hidden" name="accion" value="editar" />
        <div className="sm:col-span-2">
          <Field label="Nombre" required><input name="nombre" defaultValue={flujo.nombre} className={inputCls} required /></Field>
        </div>
        <Field label="Aplica a">
          <select name="aplicaA" className={inputCls} defaultValue={flujo.aplicaA ?? ""}>
            {Object.entries(ETIQUETA_APLICA_A).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
          </select>
        </Field>
        <div className="sm:col-span-3">
          <Field label="Descripción"><input name="descripcion" defaultValue={flujo.descripcion ?? ""} className={inputCls} /></Field>
        </div>
        <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
          <button className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">Guardar datos</button>
          <FormBoton accion={accion} name="accion" value={flujo.activo ? "desactivar" : "activar"} disabled={!flujo.activo && flujo.problemas.length > 0}
            className={flujo.activo ? "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50" : "bg-emerald-600 text-white hover:bg-emerald-700"}>
            {flujo.activo ? "Desactivar" : "Activar flujo"}
          </FormBoton>
          {flujo._count.instancias === 0 && (
            <FormBoton accion={accion} name="accion" value="eliminar" className="border border-red-200 bg-white text-red-700 hover:bg-red-50">
              Eliminar flujo
            </FormBoton>
          )}
        </div>
      </form>

      {/* Pasos */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-stone-900">Pasos ({flujo.pasos.length})</h3>
        {flujo.pasos.map((paso, idx) => (
          <div key={paso.id} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-medium text-stone-800">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-cdmb-100 text-xs font-semibold text-cdmb-700">{paso.orden}</span>
                  {paso.nombre}
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-normal text-stone-500">{ETIQUETA_TIPO_PASO[paso.tipo]}</span>
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Responsable: {ETIQUETA_ASIGNACION[paso.asignacion]}
                  {paso.asignacion === "DEPENDENCIA_FIJA" && paso.dependencia ? ` — ${paso.dependencia.nombre}` : ""}
                  {paso.asignacion === "CARGO" && paso.cargoClave ? ` — ${paso.cargoClave}` : ""}
                  {paso.slaDiasHabiles ? ` · término sugerido ${paso.slaDiasHabiles} días hábiles` : ""}
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

            {/* Transiciones del paso */}
            <div className="mt-3 space-y-1.5">
              {paso.transiciones.length === 0 && paso.tipo !== "FIN" && (
                <p className="text-xs text-amber-700">Sin salidas — agregue al menos una.</p>
              )}
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
                    <input name="etiqueta" placeholder="Continuar / Aprobar / Devolver…" className="rounded-md border border-stone-300 px-2 py-1 text-sm" required />
                  </label>
                  <label className="text-xs">
                    <span className="mb-0.5 block text-stone-500">Va al paso</span>
                    <select name="haciaPasoId" className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm" required defaultValue="">
                      <option value="" disabled>Elegir…</option>
                      {flujo.pasos.filter((x) => x.id !== paso.id).map((x) => (
                        <option key={x.id} value={x.id}>{x.orden}. {x.nombre}</option>
                      ))}
                    </select>
                  </label>
                  <button className="rounded-md border border-cdmb-600 bg-white px-2.5 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50">
                    + Salida
                  </button>
                </form>
              )}
            </div>

            <details className="mt-3 border-t border-stone-100 pt-3">
              <summary className="cursor-pointer text-xs font-medium text-cdmb-700">Editar este paso</summary>
              <form action={accion} method="post" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input type="hidden" name="accion" value="editar-paso" />
                <input type="hidden" name="pasoId" value={paso.id} />
                <div className="sm:col-span-2">
                  <Field label="Nombre" required><input name="nombre" defaultValue={paso.nombre} className={inputCls} required /></Field>
                </div>
                <Field label="Tipo">
                  <select name="tipo" defaultValue={paso.tipo} className={inputCls}>
                    {TIPOS_PASO.map((t) => (<option key={t} value={t}>{ETIQUETA_TIPO_PASO[t]}</option>))}
                  </select>
                </Field>
                <Field label="Responsable" help="Quién debe completar el paso cuando el flujo llega aquí.">
                  <select name="asignacion" defaultValue={paso.asignacion} className={inputCls}>
                    {ASIGNACIONES.map((a) => (<option key={a} value={a}>{ETIQUETA_ASIGNACION[a]}</option>))}
                  </select>
                </Field>
                <Field label="Dependencia fija" help="Solo si el responsable es «una dependencia fija».">
                  <select name="dependenciaId" defaultValue={paso.dependenciaId ?? ""} className={inputCls}>
                    <option value="">—</option>
                    {dependencias.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
                  </select>
                </Field>
                <Field label="Clave de cargo" help="Solo si el responsable es «un cargo».">
                  <input name="cargoClave" defaultValue={paso.cargoClave ?? ""} className={inputCls} placeholder="Ej. JEFE_JURIDICA" />
                </Field>
                <Field label="Término sugerido (días hábiles)">
                  <input name="slaDiasHabiles" type="number" min={1} defaultValue={paso.slaDiasHabiles ?? ""} className={inputCls} />
                </Field>
                <div className="sm:col-span-3">
                  <Field label="Instrucciones para el responsable"><textarea name="instrucciones" defaultValue={paso.instrucciones ?? ""} rows={2} className={inputCls} /></Field>
                </div>
                <div className="sm:col-span-3">
                  <button className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">Guardar paso</button>
                </div>
              </form>
            </details>
          </div>
        ))}

        <form action={accion} method="post" className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4">
          <input type="hidden" name="accion" value="agregar-paso" />
          <label className="text-sm">
            <span className="mb-0.5 block text-xs text-stone-500">Nuevo paso</span>
            <input name="nombre" placeholder="Nombre del paso" className="rounded-md border border-stone-300 px-3 py-2 text-sm" required />
          </label>
          <label className="text-sm">
            <span className="mb-0.5 block text-xs text-stone-500">Tipo</span>
            <select name="tipo" defaultValue="TAREA" className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm">
              {TIPOS_PASO.map((t) => (<option key={t} value={t}>{ETIQUETA_TIPO_PASO[t]}</option>))}
            </select>
          </label>
          <button className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
            <Plus className="h-3.5 w-3.5" aria-hidden /> Agregar paso
          </button>
          <span className="text-xs text-stone-400">Entra antes del paso «Fin» si el último lo es.</span>
        </form>
      </div>
    </div>
  );
}

/** Botón que envía un mini-form con un par nombre/valor (para acciones sin campos). */
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
