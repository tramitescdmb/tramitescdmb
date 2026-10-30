import Link from "next/link";
import { Workflow, Plus, Download, CheckCircle2, CircleDashed, PlayCircle, AlertTriangle, Flag } from "lucide-react";
import { listarFlujos, plantillasDeModulo } from "@/lib/flujos";
import { resumenUsoFlujos, sumarUso } from "@/lib/flujos-indicadores";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { etiquetaAplicaA, OPCIONES_APLICA_A, RUTA_FLUJOS, type ModuloFlujo } from "@/lib/flujos-modulos";
import { Field } from "@/components/Field";
import { CabeceraTablero, Chip, Indicador } from "@/components/tablero";

const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";

const DESCRIPCION: Record<ModuloFlujo, string> = {
  SGDEA:
    "Un flujo define los pasos por los que pasa una comunicación o un expediente documental, quién responde por cada uno y a dónde va después. Se aplica desde el detalle y avanza paso a paso con constancia en la trazabilidad (MoReq cap. 7).",
  GECON:
    "Un flujo define tareas internas sobre un expediente contractual (revisiones, aprobaciones, liquidación): los pasos, quién responde por cada uno y a dónde va después. No cambia las etapas del contrato; se aplica desde la ficha del expediente.",
  TRAMITES:
    "Un flujo define tareas internas sobre un expediente de trámite (proyección y revisión de actos, revisión de información): los pasos, quién responde por cada uno y a dónde va después. No cambia los pasos del procedimiento; se aplica desde la ficha del expediente.",
};

const th = "whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500";
const td = "px-3 py-2 align-top";

export async function ListaFlujos({ modulo, ok, error }: { modulo: ModuloFlujo; ok?: string; error?: string }) {
  const calendario = await getCalendarioLaboral();
  const [todos, uso] = await Promise.all([listarFlujos(modulo), resumenUsoFlujos(modulo, calendario)]);
  const familias = new Map<string, typeof todos>();
  for (const f of todos) familias.set(f.familiaId ?? f.id, [...(familias.get(f.familiaId ?? f.id) ?? []), f]);
  const flujos = [...familias.values()]
    .map((grupo) => ({
      ...(grupo.find((f) => f.activo) ?? [...grupo].sort((a, b) => b.version - a.version)[0]!),
      totalVersiones: grupo.length,
      uso: sumarUso(grupo.map((f) => uso.get(f.id))),
    }))
    .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, "es"));
  const total = sumarUso(flujos.map((f) => f.uso));
  const plantillas = plantillasDeModulo(modulo);
  const opciones = Object.entries(OPCIONES_APLICA_A[modulo]);
  const ruta = RUTA_FLUJOS[modulo];

  return (
    <div className="space-y-4">
      {ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</div>}
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <CabeceraTablero icon={Workflow} titulo="Flujos de trabajo" contador={flujos.length} descripcion={DESCRIPCION[modulo]}>
        <Indicador icon={CheckCircle2} valor={flujos.filter((f) => f.activo).length} etiqueta="Vigentes" tono="cdmb" />
        <Indicador icon={PlayCircle} valor={total.enCurso} etiqueta="En curso" tono="cielo" />
        <Indicador icon={AlertTriangle} valor={total.vencidos} etiqueta="Pasos vencidos" tono="ambar" alerta={total.vencidos > 0} />
        <Indicador icon={Flag} valor={total.completados} etiqueta="Completados" tono="verde" />
      </CabeceraTablero>

      <div className="flex flex-wrap items-center gap-2">
        <details className="relative">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md bg-acento-500 px-3 py-2 text-sm font-medium text-white hover:bg-acento-600 [&::-webkit-details-marker]:hidden">
            <Plus className="h-3.5 w-3.5" aria-hidden /> Nuevo flujo
          </summary>
          <form
            action="/api/flujos"
            method="post"
            className="absolute left-0 z-20 mt-1 grid w-[min(36rem,90vw)] grid-cols-1 gap-3 rounded-md border border-stone-200 bg-white p-4 shadow-soft-lg sm:grid-cols-3"
          >
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
              <button className="rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600">Crear flujo</button>
            </div>
          </form>
        </details>
        {plantillas.length > 0 && (
          <form action="/api/flujos" method="post">
            <input type="hidden" name="modulo" value={modulo} />
            <input type="hidden" name="accion" value="cargar-plantillas" />
            <button
              title={plantillas.map((p) => p.nombre).join(" · ")}
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Cargar plantillas ({plantillas.length})
            </button>
          </form>
        )}
      </div>

      {flujos.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-200 bg-white p-6 text-center text-sm text-stone-400">
          Sin flujos. {plantillas.length > 0 ? "Cargue las plantillas o cree uno nuevo." : "Cree uno nuevo."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr>
                <th className={th}>Flujo</th>
                <th className={`${th} hidden md:table-cell`}>Aplica a</th>
                <th className={`${th} text-right`}>Pasos</th>
                <th className={`${th} text-right`}>En curso</th>
                <th className={`${th} text-right`}>Vencidos</th>
                <th className={`${th} hidden text-right sm:table-cell`}>Completados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {flujos.map((f) => (
                <tr key={f.id} className="hover:bg-stone-50">
                  <td className={td}>
                    <Link href={`${ruta}/${f.id}`} className="flex items-start gap-2 font-medium text-stone-800 hover:text-cdmb-700 hover:underline">
                      {f.activo ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" aria-hidden />
                      ) : (
                        <CircleDashed className="mt-0.5 h-4 w-4 flex-none text-stone-400" aria-hidden />
                      )}
                      <span className="min-w-0" title={f.descripcion ?? undefined}>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {f.nombre}
                          {!f.activo && <Chip>Inactivo</Chip>}
                          {f.totalVersiones > 1 && (
                            <Chip tono="cdmb">
                              v{f.version} de {f.totalVersiones}
                            </Chip>
                          )}
                          {f.inicioAutomatico && <Chip tono="cielo">Automático</Chip>}
                        </span>
                        {f.descripcion && <span className="block max-w-[26rem] truncate text-xs font-normal text-stone-400">{f.descripcion}</span>}
                      </span>
                    </Link>
                  </td>
                  <td className={`${td} hidden whitespace-nowrap text-xs text-stone-500 md:table-cell`}>{etiquetaAplicaA(f)}</td>
                  <td className={`${td} text-right tabular-nums text-stone-600`}>{f._count.pasos}</td>
                  <td className={`${td} text-right tabular-nums`}>{f.uso.enCurso || <span className="text-stone-300">0</span>}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {f.uso.vencidos ? <span className="font-semibold text-red-600">{f.uso.vencidos}</span> : <span className="text-stone-300">0</span>}
                  </td>
                  <td className={`${td} hidden text-right tabular-nums text-stone-600 sm:table-cell`}>{f.uso.completados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
