import Link from "next/link";
import { Workflow, Plus, Download, ChevronRight, CheckCircle2, CircleDashed } from "lucide-react";
import { listarFlujos, plantillasDeModulo } from "@/lib/flujos";
import { etiquetaAplicaA, OPCIONES_APLICA_A, RUTA_FLUJOS, type ModuloFlujo } from "@/lib/flujos-modulos";
import { Field } from "@/components/Field";
import { CabeceraTablero } from "@/components/tablero";

const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";

const DESCRIPCION: Record<ModuloFlujo, string> = {
  SGDEA:
    "Un flujo define los pasos por los que pasa una comunicación o un expediente documental, quién responde por cada uno y a dónde va después. Se aplica desde el detalle y avanza paso a paso con constancia en la trazabilidad (MoReq cap. 7).",
  GECON:
    "Un flujo define tareas internas sobre un expediente contractual (revisiones, aprobaciones, liquidación): los pasos, quién responde por cada uno y a dónde va después. No cambia las etapas del contrato; se aplica desde la ficha del expediente.",
  TRAMITES:
    "Un flujo define tareas internas sobre un expediente de trámite (proyección y revisión de actos, revisión de información): los pasos, quién responde por cada uno y a dónde va después. No cambia los pasos del procedimiento; se aplica desde la ficha del expediente.",
};

export async function ListaFlujos({ modulo, ok, error }: { modulo: ModuloFlujo; ok?: string; error?: string }) {
  const flujos = await listarFlujos(modulo);
  const plantillas = plantillasDeModulo(modulo);
  const opciones = Object.entries(OPCIONES_APLICA_A[modulo]);
  const ruta = RUTA_FLUJOS[modulo];

  return (
    <div className="space-y-4">
      {ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</div>}
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <CabeceraTablero icon={Workflow} titulo="Flujos de trabajo" contador={flujos.length} descripcion={DESCRIPCION[modulo]} />

      {plantillas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <form action="/api/flujos" method="post">
            <input type="hidden" name="modulo" value={modulo} />
            <input type="hidden" name="accion" value="cargar-plantillas" />
            <button className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              <Download className="h-3.5 w-3.5" aria-hidden />
              Cargar flujos de plantilla
            </button>
          </form>
          <span className="text-xs text-stone-400">{plantillas.map((p) => p.nombre).join(" · ")}</span>
        </div>
      )}

      <details className="rounded-md border border-stone-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-stone-900">Crear un flujo desde cero</summary>
        <form action="/api/flujos" method="post" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input type="hidden" name="modulo" value={modulo} />
          <input type="hidden" name="accion" value="crear" />
          <div className={opciones.length > 1 ? "sm:col-span-2" : "sm:col-span-3"}>
            <Field label="Nombre" required>
              <input name="nombre" className={inputCls} required />
            </Field>
          </div>
          {opciones.length > 1 ? (
            <Field label="Aplica a">
              <select name="aplicaA" className={inputCls} defaultValue="">
                {opciones.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <input type="hidden" name="aplicaA" value={opciones[0]?.[0] ?? ""} />
          )}
          <div className="sm:col-span-3">
            <Field label="Descripción">
              <input name="descripcion" className={inputCls} placeholder="Opcional" />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <button className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Crear flujo
            </button>
          </div>
        </form>
      </details>

      {flujos.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-200 bg-white p-6 text-center text-sm text-stone-400">
          Todavía no hay flujos. {plantillas.length > 0 ? "Cargue las plantillas o cree uno desde cero." : "Cree uno desde cero."}
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-md border border-stone-200 bg-white">
          {flujos.map((f) => (
            <li key={f.id}>
              <Link href={`${ruta}/${f.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-stone-800">
                    {f.activo ? <CheckCircle2 className="h-4 w-4 flex-none text-emerald-600" aria-hidden /> : <CircleDashed className="h-4 w-4 flex-none text-stone-400" aria-hidden />}
                    {f.nombre}
                    {f.esPlantilla && <span className="rounded-sm bg-stone-100 px-2 py-0.5 text-[11px] font-normal text-stone-500">Plantilla</span>}
                    {f.inicioAutomatico && <span className="rounded-sm bg-cdmb-50 px-2 py-0.5 text-[11px] font-medium text-cdmb-700">Inicio automático</span>}
                    <span className={`rounded-sm px-2 py-0.5 text-[11px] font-medium ${f.activo ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                      {f.activo ? "Activo" : "Inactivo"}
                    </span>
                  </p>
                  {f.descripcion && <p className="mt-0.5 truncate text-xs text-stone-500">{f.descripcion}</p>}
                  <p className="mt-1 text-[11px] text-stone-400">
                    {etiquetaAplicaA(f)} · {f._count.pasos} paso{f._count.pasos === 1 ? "" : "s"} · {f._count.instancias} aplicación{f._count.instancias === 1 ? "" : "es"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 flex-none text-stone-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
