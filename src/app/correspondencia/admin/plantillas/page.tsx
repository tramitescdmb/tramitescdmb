import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText, Plus } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { listarPlantillasAdmin, ETIQUETA_AMBITO, AMBITOS } from "@/lib/plantillas";
import { Field, SectionHelp } from "@/components/Field";
import { registrarAccesoDenegadoSeccion } from "@/lib/auditoria-doc";
import { headers } from "next/headers";

const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

export default async function PlantillasAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoSeccion("Administración TRD", session, await headers());
    redirect("/correspondencia");
  }

  const sp = await searchParams;
  const plantillas = await listarPlantillasAdmin();

  return (
    <div className="space-y-6">
      <Link href="/correspondencia/admin" className="inline-flex items-center gap-1.5 text-sm text-cdmb-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Volver a Administración
      </Link>

      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <FileText className="h-4 w-4 text-cdmb-600" aria-hidden /> Plantillas de documentos
        </h2>
        <SectionHelp>
          Cuerpos preescritos que un funcionario puede cargar al redactar un oficio de salida, un memorando interno o
          la respuesta a una comunicación recibida — para no volver a escribir desde cero lo que se repite. Es solo
          texto: al cargarla en el formulario, el contenido queda editable antes de radicar y firmar. El{" "}
          <strong>ámbito</strong> decide en qué formularios aparece.
        </SectionHelp>

        <details className="rounded-xl border border-stone-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-stone-900">Crear una plantilla</summary>
          <form action="/api/correspondencia/plantillas" method="post" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="Nombre" required>
                <input name="nombre" className={inputCls} placeholder="Ej. Respuesta estándar a solicitud de información" required />
              </Field>
            </div>
            <Field label="Ámbito" help="En qué formularios se ofrece esta plantilla.">
              <select name="ambito" className={inputCls} defaultValue="AMBAS">
                {AMBITOS.map((a) => (<option key={a} value={a}>{ETIQUETA_AMBITO[a]}</option>))}
              </select>
            </Field>
            <div className="sm:col-span-3">
              <Field label="Descripción" help="Nota corta para quien elige la plantilla — opcional.">
                <input name="descripcion" className={inputCls} placeholder="Cuándo conviene usar esta plantilla" />
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Field label="Cuerpo" required help="El texto que se cargará en el campo de contenido. Puede dejar marcas como [FECHA] o [NOMBRE] para completar a mano.">
                <textarea name="cuerpo" rows={8} className={inputCls} placeholder="Cuerpo de la plantilla…" required />
              </Field>
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
                <Plus className="h-3.5 w-3.5" aria-hidden /> Crear plantilla
              </button>
            </div>
          </form>
        </details>

        {plantillas.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-400">Todavía no hay plantillas.</p>
        ) : (
          <div className="space-y-3">
            {plantillas.map((p) => (
              <details key={p.id} className={`rounded-xl border border-stone-200 bg-white p-4 ${p.activo ? "" : "opacity-60"}`}>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium text-stone-800">
                  {p.nombre}
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-normal text-stone-500">{ETIQUETA_AMBITO[p.ambito]}</span>
                  {!p.activo && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-normal text-stone-500">Inactiva</span>}
                </summary>
                <form action={`/api/correspondencia/plantillas/${p.id}`} method="post" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input type="hidden" name="accion" value="editar" />
                  <div className="sm:col-span-2">
                    <Field label="Nombre" required>
                      <input name="nombre" defaultValue={p.nombre} className={inputCls} required />
                    </Field>
                  </div>
                  <Field label="Ámbito">
                    <select name="ambito" className={inputCls} defaultValue={p.ambito}>
                      {AMBITOS.map((a) => (<option key={a} value={a}>{ETIQUETA_AMBITO[a]}</option>))}
                    </select>
                  </Field>
                  <div className="sm:col-span-3">
                    <Field label="Descripción">
                      <input name="descripcion" defaultValue={p.descripcion ?? ""} className={inputCls} />
                    </Field>
                  </div>
                  <div className="sm:col-span-3">
                    <Field label="Cuerpo" required>
                      <textarea name="cuerpo" defaultValue={p.cuerpo} rows={8} className={inputCls} required />
                    </Field>
                  </div>
                  <div className="sm:col-span-3 flex items-center gap-3">
                    <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">Guardar cambios</button>
                  </div>
                </form>
                <form action={`/api/correspondencia/plantillas/${p.id}`} method="post" className="mt-2">
                  <input type="hidden" name="accion" value="toggle" />
                  <input type="hidden" name="activo" value={p.activo ? "false" : "true"} />
                  <button type="submit" className="text-xs font-medium text-cdmb-700 hover:underline">
                    {p.activo ? "Desactivar esta plantilla" : "Reactivar esta plantilla"}
                  </button>
                </form>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
