import { redirect } from "next/navigation";
import { CalendarOff, CalendarDays, Plus, Trash2 } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { listarDiasNoLaborados, ETIQUETA_DIA_SEMANA, ORDEN_DIAS_SEMANA } from "@/lib/calendario-laboral";
import { festivosColombia } from "@/lib/dias-habiles";
import { Field, SectionHelp } from "@/components/Field";
import { TituloSeccion } from "@/components/sgdea/ui";
import { formatearFechaSolo } from "@/lib/fecha";

const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

export default async function CalendarioLaboralPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Config de toda la Corporación (afecta términos de ley entidad-wide): ADMIN, igual que sus rutas de API.
  if (session.rol !== "ADMIN") redirect("/correspondencia");

  const sp = await searchParams;
  const [config, dias] = await Promise.all([getConfiguracionSitio(), listarDiasNoLaborados()]);
  const jornada = new Set(config.jornadaDiasSemana);

  const anio = new Date().getFullYear();
  const festivosEsteAnio = [...festivosColombia(anio)].sort();
  const hoyIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <TituloSeccion icon={CalendarDays}>Calendario laboral</TituloSeccion>
        <SectionHelp>
          Define la jornada de la Corporación y los días compensados o cierres institucionales. Alimenta el
          cálculo de los términos de ley y las métricas de tiempo del SGDEA. Los festivos de ley de Colombia
          ya se descuentan solos.
        </SectionHelp>
      </div>

      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      {/* Jornada */}
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <CalendarDays className="h-4 w-4 text-cdmb-600" aria-hidden /> Jornada laboral
        </h3>
        <SectionHelp>
          Los <strong>días de la semana</strong> marcados cuentan como hábiles para los términos. El horario
          se usa para las métricas de tiempo (todavía no afina el cálculo por horas — eso es un paso futuro).
        </SectionHelp>
        <form action="/api/calendario-laboral/jornada" method="post" className="mt-3 space-y-4">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {ORDEN_DIAS_SEMANA.map((d) => (
              <label key={d} className="flex items-center gap-1.5 text-sm text-stone-700">
                <input type="checkbox" name="dia" value={d} defaultChecked={jornada.has(d)} className="rounded border-stone-300" />
                {ETIQUETA_DIA_SEMANA[d]}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:max-w-xs">
            <Field label="Hora de inicio">
              <input type="time" name="horaInicio" defaultValue={config.jornadaHoraInicio} required className={inputCls} />
            </Field>
            <Field label="Hora de fin">
              <input type="time" name="horaFin" defaultValue={config.jornadaHoraFin} required className={inputCls} />
            </Field>
          </div>
          <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">Guardar jornada</button>
        </form>
      </section>

      {/* Días no laborados */}
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <CalendarOff className="h-4 w-4 text-cdmb-600" aria-hidden /> Días no laborados de la Corporación
        </h3>
        <SectionHelp>
          Días compensados, puentes internos o cierres — <strong>además</strong> de los festivos de ley.
          Se descuentan del cálculo hacia adelante; los términos ya calculados no cambian solos.
        </SectionHelp>
        <form action="/api/calendario-laboral/dia" method="post" className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Fecha" required>
            <input type="date" name="fecha" min={hoyIso} required className={inputCls} />
          </Field>
          <div className="min-w-[220px] flex-1">
            <Field label="Motivo" required>
              <input name="motivo" placeholder="Ej. Día compensado Semana Santa" required className={inputCls} />
            </Field>
          </div>
          <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
            <Plus className="h-3.5 w-3.5" aria-hidden /> Agregar
          </button>
        </form>

        {dias.length === 0 ? (
          <p className="mt-3 text-sm text-stone-400">No hay días no laborados registrados.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-stone-200">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr><th className="px-3 py-2 font-medium">Fecha</th><th className="px-3 py-2 font-medium">Motivo</th><th className="px-3 py-2 font-medium">Estado</th><th className="px-3 py-2"></th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {dias.map((d) => (
                  <tr key={d.id} className={d.activo ? "" : "opacity-50"}>
                    <td className="px-3 py-2 text-stone-700">{formatearFechaSolo(d.fecha)}</td>
                    <td className="px-3 py-2 text-stone-600">{d.motivo}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${d.activo ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                        {d.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-3">
                        <form action={`/api/calendario-laboral/dia/${d.id}`} method="post">
                          <input type="hidden" name="accion" value="toggle" />
                          <input type="hidden" name="activo" value={d.activo ? "false" : "true"} />
                          <button className="text-xs font-medium text-cdmb-700 hover:underline">{d.activo ? "Desactivar" : "Activar"}</button>
                        </form>
                        <form action={`/api/calendario-laboral/dia/${d.id}`} method="post">
                          <input type="hidden" name="accion" value="eliminar" />
                          <button className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"><Trash2 className="h-3 w-3" aria-hidden />Eliminar</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Festivos de ley (referencia) */}
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-900">Festivos de ley {anio} (referencia)</h3>
        <SectionHelp>Se calculan solos (Ley 51/1983 — Ley Emiliani) y no se editan aquí.</SectionHelp>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
          {festivosEsteAnio.map((f) => (
            <li key={f}>{formatearFechaSolo(f)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
