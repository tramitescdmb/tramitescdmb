import { redirect } from "next/navigation";
import { FileText, Plus, Copy, Eye } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeAdministrarArchivo } from "@/lib/permisos";
import { listarPlantillasAdmin, listarCategoriasPlantilla, ETIQUETA_AMBITO, AMBITOS, MARCADORES } from "@/lib/plantillas";
import { Field, SectionHelp } from "@/components/Field";

const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

export default async function PlantillasPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/correspondencia");
  const esAdmin = puedeAdministrarArchivo(permisos);

  const sp = await searchParams;
  const [plantillas, categorias] = await Promise.all([listarPlantillasAdmin(), listarCategoriasPlantilla()]);

  // Agrupar por categoría para la lista.
  const grupos = new Map<string, typeof plantillas>();
  for (const p of plantillas) {
    const k = p.categoria ?? "Sin categoría";
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(p);
  }

  return (
    <div className="space-y-6">
      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <FileText className="h-4 w-4 text-cdmb-600" aria-hidden /> Plantillas de documentos
        </h2>
        <SectionHelp>
          Cuerpos y asuntos preescritos que se cargan al redactar un oficio de salida, un memorando, una
          respuesta o la descripción de un expediente — para no volver a escribir desde cero lo que se repite.
          Al cargar una plantilla, su contenido queda <strong>editable</strong> antes de radicar y firmar. El{" "}
          <strong>ámbito</strong> decide en qué formulario aparece.
        </SectionHelp>
      </div>

      <details className="rounded-xl border border-stone-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-stone-900">Marcadores que se rellenan solos</summary>
        <div className="mt-3">
          <SectionHelp>
            Escriba un marcador entre corchetes en el asunto o el cuerpo y se reemplazará solo al cargar la
            plantilla, con el dato real del formulario. Los que no se conozcan se dejan tal cual y se avisan
            como pendientes de completar.
          </SectionHelp>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            {MARCADORES.map((m) => (
              <div key={m.clave} className="flex gap-2 text-sm">
                <dt className="font-mono text-cdmb-700">[{m.clave}]</dt>
                <dd className="text-stone-500">{m.descripcion}</dd>
              </div>
            ))}
          </dl>
        </div>
      </details>

      {esAdmin && (
        <details className="rounded-xl border border-stone-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-stone-900">Crear una plantilla</summary>
          <form action="/api/correspondencia/plantillas" method="post" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="Nombre" required>
                <input name="nombre" className={inputCls} placeholder="Ej. Respuesta estándar a solicitud de información" required />
              </Field>
            </div>
            <Field label="Ámbito" help="En qué formulario se ofrece.">
              <select name="ambito" className={inputCls} defaultValue="AMBAS">
                {AMBITOS.map((a) => (<option key={a} value={a}>{ETIQUETA_AMBITO[a]}</option>))}
              </select>
            </Field>
            <Field label="Categoría" help="Opcional — agrupa la lista.">
              <input name="categoria" className={inputCls} list="categorias-plantilla" placeholder="Opcional" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Descripción" help="Nota corta para quien elige la plantilla — opcional.">
                <input name="descripcion" className={inputCls} placeholder="Cuándo conviene usar esta plantilla" />
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Field label="Asunto (plantilla)" help="Opcional. Puede usar marcadores, ej. Respuesta a [RADICADO] — [ASUNTO].">
                <input name="asunto" className={inputCls} placeholder="Opcional" />
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Field label="Cuerpo" required help="El texto que se cargará. Puede usar marcadores entre corchetes.">
                <textarea name="cuerpo" rows={8} className={inputCls} placeholder={"[CIUDAD], [FECHA]\n\nSeñor(a) [DESTINATARIO]\n\n…"} required />
              </Field>
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
                <Plus className="h-3.5 w-3.5" aria-hidden /> Crear plantilla
              </button>
            </div>
          </form>
        </details>
      )}

      <datalist id="categorias-plantilla">
        {categorias.map((c) => (<option key={c} value={c} />))}
      </datalist>

      {plantillas.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-400">Todavía no hay plantillas.</p>
      ) : (
        [...grupos.entries()].map(([categoria, lista]) => (
          <section key={categoria} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{categoria}</h3>
            {lista.map((p) => (
              <details key={p.id} className={`rounded-xl border border-stone-200 bg-white p-4 ${p.activo ? "" : "opacity-60"}`}>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium text-stone-800">
                  <Eye className="h-3.5 w-3.5 flex-none text-stone-400" aria-hidden />
                  {p.nombre}
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-normal text-stone-500">{ETIQUETA_AMBITO[p.ambito]}</span>
                  {p.vecesUsada > 0 && <span className="text-[11px] font-normal text-stone-400">· usada {p.vecesUsada} {p.vecesUsada === 1 ? "vez" : "veces"}</span>}
                  {!p.activo && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-normal text-stone-500">Inactiva</span>}
                </summary>

                <div className="mt-3 space-y-2">
                  {p.descripcion && <p className="text-xs text-stone-500">{p.descripcion}</p>}
                  {p.asunto && (
                    <p className="text-sm"><span className="text-[11px] uppercase tracking-wide text-stone-400">Asunto</span><br />{p.asunto}</p>
                  )}
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">{p.cuerpo}</pre>
                </div>

                {esAdmin && (
                  <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
                    <form action={`/api/correspondencia/plantillas/${p.id}`} method="post" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <input type="hidden" name="accion" value="editar" />
                      <div className="sm:col-span-2">
                        <Field label="Nombre" required><input name="nombre" defaultValue={p.nombre} className={inputCls} required /></Field>
                      </div>
                      <Field label="Ámbito">
                        <select name="ambito" className={inputCls} defaultValue={p.ambito}>
                          {AMBITOS.map((a) => (<option key={a} value={a}>{ETIQUETA_AMBITO[a]}</option>))}
                        </select>
                      </Field>
                      <Field label="Categoría"><input name="categoria" defaultValue={p.categoria ?? ""} list="categorias-plantilla" className={inputCls} /></Field>
                      <div className="sm:col-span-2">
                        <Field label="Descripción"><input name="descripcion" defaultValue={p.descripcion ?? ""} className={inputCls} /></Field>
                      </div>
                      <div className="sm:col-span-3">
                        <Field label="Asunto (plantilla)"><input name="asunto" defaultValue={p.asunto ?? ""} className={inputCls} /></Field>
                      </div>
                      <div className="sm:col-span-3">
                        <Field label="Cuerpo" required><textarea name="cuerpo" defaultValue={p.cuerpo} rows={8} className={inputCls} required /></Field>
                      </div>
                      <div className="sm:col-span-3">
                        <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">Guardar cambios</button>
                      </div>
                    </form>
                    <div className="flex flex-wrap items-center gap-4">
                      <form action={`/api/correspondencia/plantillas/${p.id}`} method="post">
                        <input type="hidden" name="accion" value="duplicar" />
                        <button type="submit" className="inline-flex items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline">
                          <Copy className="h-3.5 w-3.5" aria-hidden /> Duplicar
                        </button>
                      </form>
                      <form action={`/api/correspondencia/plantillas/${p.id}`} method="post">
                        <input type="hidden" name="accion" value="toggle" />
                        <input type="hidden" name="activo" value={p.activo ? "false" : "true"} />
                        <button type="submit" className="text-xs font-medium text-cdmb-700 hover:underline">
                          {p.activo ? "Desactivar" : "Reactivar"}
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </details>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
