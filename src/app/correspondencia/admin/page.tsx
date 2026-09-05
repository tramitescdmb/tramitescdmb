import { redirect } from "next/navigation";
import { Building2, FolderTree, Plus } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { listarDependencias, listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeries, ETIQUETA_DISPOSICION } from "@/lib/trd";
import { Field, SectionHelp } from "@/components/Field";

const DISPOSICIONES = ["CONSERVACION_TOTAL", "ELIMINACION", "SELECCION", "MICROFILMACION_DIGITALIZACION"];
const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

export default async function CorrespondenciaAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) redirect("/correspondencia");

  const sp = await searchParams;
  const [dependencias, dependenciasActivas, series] = await Promise.all([
    listarDependencias(),
    listarDependenciasActivas(),
    listarSeries(),
  ]);

  return (
    <div className="space-y-6">
      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      {/* Dependencias / organigrama */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <Building2 className="h-4 w-4 text-cdmb-600" aria-hidden /> Dependencias (organigrama)
        </h2>
        <SectionHelp>
          El organigrama determina a quién se le puede distribuir una comunicación y quién puede firmar memorandos en
          nombre de cada área. Una dependencia inactiva deja de aparecer para asignar cosas nuevas, pero no borra su
          historial.
        </SectionHelp>

        <form action="/api/correspondencia/dependencias" method="post" className="grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-4">
          <Field label="Código" required help="Sigla corta y única, ej. SEYCA.">
            <input name="codigo" className={inputCls} placeholder="Ej. SEYCA" required />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Nombre" required>
              <input name="nombre" className={inputCls} required />
            </Field>
          </div>
          <Field label="Depende de" help="La dependencia jerárquicamente superior, si tiene. Déjelo vacío si es de primer nivel.">
            <select name="parentId" className={inputCls}>
              <option value="">— Ninguna (nivel raíz) —</option>
              {dependenciasActivas.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
            </select>
          </Field>
          <div className="sm:col-span-4">
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Agregar dependencia
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">Código</th>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 text-right font-medium">Funcionarios</th>
                <th className="px-4 py-2 text-right font-medium">Comunicaciones</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {dependencias.map((d) => (
                <tr key={d.id} className={d.activo ? "" : "opacity-50"}>
                  <td className="px-4 py-2 font-medium text-stone-700" style={{ paddingLeft: `${16 + d.nivel * 16}px` }}>{d.codigo}</td>
                  <td className="px-4 py-2 text-stone-800">{d.nombre}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500">{d._count.usuarios}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500">{d._count.comunicacionesDestino}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${d.activo ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                      {d.activo ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={`/api/correspondencia/dependencias/${d.id}/toggle`} method="post">
                      <button className="text-xs font-medium text-cdmb-700 hover:underline">{d.activo ? "Desactivar" : "Activar"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* TRD / CCD */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <FolderTree className="h-4 w-4 text-cdmb-600" aria-hidden /> Tablas de Retención Documental (TRD/CCD)
        </h2>
        <SectionHelp>
          La TRD clasifica cada comunicación por el tipo de asunto que trata (una &quot;serie&quot;, ej. Contratos) y
          define por cuánto tiempo debe conservarse antes de transferirla o eliminarla (Acuerdo 060/2001 AGN). Puede
          tener varias versiones de una misma serie a la vez — útil para migrar de una TRD antigua a una nueva sin
          perder la clasificación de lo ya radicado.
        </SectionHelp>

        <form action="/api/correspondencia/series" method="post" className="grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-4">
          <Field label="Código de serie" required>
            <input name="codigo" className={inputCls} placeholder="Ej. 100" required />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Nombre" required>
              <input name="nombre" className={inputCls} placeholder="Ej. Contratos" required />
            </Field>
          </div>
          <Field label="Versión" help="Súbala al crear una TRD nueva sin perder la anterior — ambas quedan disponibles.">
            <input name="version" className={inputCls} defaultValue="1" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Dependencia productora" help="El área dueña de este tipo de documentos.">
              <select name="dependenciaId" className={inputCls}>
                <option value="">— Ninguna —</option>
                {dependenciasActivas.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
              </select>
            </Field>
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Agregar serie
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {series.length > 0 && (
            <p className="text-xs text-stone-400">
              Al agregar una subserie: <strong>Gestión</strong> = años que se guarda en la oficina que la produjo;{" "}
              <strong>Central</strong> = años adicionales en el archivo central después; <strong>Disposición</strong> = qué
              pasa al cumplirse ambos plazos (conservar siempre, eliminar, seleccionar una muestra, o microfilmar/digitalizar).
            </p>
          )}
          {series.length === 0 && <p className="rounded-xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-400">Aún no hay series documentales. Agregue la primera arriba.</p>}
          {series.map((s) => (
            <div key={s.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 bg-stone-50 px-4 py-2.5">
                <div>
                  <span className="text-sm font-semibold text-stone-800">{s.codigo} — {s.nombre}</span>
                  <span className="ml-2 text-xs text-stone-400">v{s.version}{s.dependencia ? ` · ${s.dependencia.nombre}` : ""}{s.vigenteHasta ? " · versión anterior" : ""}</span>
                </div>
                <span className="text-xs text-stone-400">{s.subseries.length} subserie(s) · {s._count.comunicaciones} comunicación(es)</span>
              </div>
              {s.subseries.length > 0 && (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-stone-100">
                    {s.subseries.map((ss) => (
                      <tr key={ss.id}>
                        <td className="px-4 py-1.5 font-medium text-stone-600">{ss.codigo}</td>
                        <td className="px-4 py-1.5 text-stone-800">{ss.nombre}</td>
                        <td className="px-4 py-1.5 text-xs text-stone-500">Gestión {ss.retencionGestionAnios}a · Central {ss.retencionCentralAnios}a</td>
                        <td className="px-4 py-1.5 text-xs text-stone-500">{ss.disposicionFinal ? ETIQUETA_DISPOSICION[ss.disposicionFinal] : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <form action="/api/correspondencia/subseries" method="post" className="grid grid-cols-1 gap-2 border-t border-stone-100 p-3 sm:grid-cols-6">
                <input type="hidden" name="serieId" value={s.id} />
                <input name="codigo" className={inputCls} placeholder="Cód. subserie" required />
                <input name="nombre" className={`${inputCls} sm:col-span-2`} placeholder="Nombre de la subserie" required />
                <input name="retencionGestionAnios" type="number" min={0} className={inputCls} placeholder="Gestión (años)" />
                <input name="retencionCentralAnios" type="number" min={0} className={inputCls} placeholder="Central (años)" />
                <select name="disposicionFinal" className={inputCls}>
                  <option value="">Disposición…</option>
                  {DISPOSICIONES.map((d) => (<option key={d} value={d}>{ETIQUETA_DISPOSICION[d]}</option>))}
                </select>
                <div className="sm:col-span-6">
                  <button type="submit" className="text-xs font-medium text-cdmb-700 hover:underline">+ Agregar subserie</button>
                </div>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
