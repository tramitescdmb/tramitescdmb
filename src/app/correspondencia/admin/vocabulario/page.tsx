import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Tags, Plus } from "lucide-react";
import { EnlaceDescarga } from "@/components/EnlaceDescarga";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { listarTerminos } from "@/lib/vocabulario";
import { Field, SectionHelp } from "@/components/Field";
import { registrarAccesoDenegadoSeccion } from "@/lib/auditoria-doc";
import { headers } from "next/headers";

const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

export default async function VocabularioAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoSeccion("Administración TRD", session, await headers());
    redirect("/correspondencia");
  }

  const sp = await searchParams;
  const terminos = await listarTerminos(false);

  return (
    <div className="space-y-6">
      <Link href="/correspondencia/admin" className="inline-flex items-center gap-1.5 text-sm text-cdmb-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Volver a Administración
      </Link>

      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <section className="space-y-3">
        <h2 className="flex flex-wrap items-center justify-between gap-2 text-base font-semibold text-stone-900">
          <span className="flex items-center gap-2"><Tags className="h-4 w-4 text-cdmb-600" aria-hidden /> Vocabulario controlado</span>
          <span className="flex items-center gap-3 text-xs">
            <EnlaceDescarga href="/api/correspondencia/vocabulario/exportar">CSV</EnlaceDescarga>
            <EnlaceDescarga href="/api/correspondencia/vocabulario/exportar?formato=xml">XML</EnlaceDescarga>
          </span>
        </h2>
        <SectionHelp>
          Lista normalizada de palabras clave (MoReq 1.17). Al etiquetar una comunicación solo se pueden usar
          términos de esta lista — así dos personas describen el mismo asunto con la misma palabra y la búsqueda
          por palabra clave es consistente. La <strong>categoría</strong> es opcional, solo agrupa la lista.
        </SectionHelp>

        <form action="/api/correspondencia/vocabulario" method="post" className="grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Término" required>
              <input name="termino" className={inputCls} placeholder="Ej. Vertimientos" required />
            </Field>
          </div>
          <Field label="Categoría" help="Opcional — ej. Recurso, Trámite.">
            <input name="categoria" className={inputCls} placeholder="Opcional" />
          </Field>
          <div className="sm:col-span-3">
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Agregar término
            </button>
          </div>
        </form>

        {terminos.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-400">El vocabulario está vacío.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Término</th>
                  <th className="px-4 py-2 font-medium">Categoría</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {terminos.map((t) => (
                  <tr key={t.id} className={t.activo ? "" : "opacity-50"}>
                    <td className="px-4 py-2">
                      <form action={`/api/correspondencia/vocabulario/${t.id}`} method="post" className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="accion" value="editar" />
                        <input name="termino" defaultValue={t.termino} className="rounded-md border border-stone-300 px-2 py-1 text-sm" />
                        <input name="categoria" defaultValue={t.categoria ?? ""} placeholder="categoría" className="w-32 rounded-md border border-stone-300 px-2 py-1 text-sm" />
                        <button className="rounded-md border border-stone-300 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50">Guardar</button>
                      </form>
                    </td>
                    <td className="px-4 py-2 text-stone-500">{t.categoria ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${t.activo ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                        {t.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form action={`/api/correspondencia/vocabulario/${t.id}`} method="post">
                        <input type="hidden" name="accion" value="toggle" />
                        <input type="hidden" name="activo" value={t.activo ? "false" : "true"} />
                        <button className="text-xs font-medium text-cdmb-700 hover:underline">{t.activo ? "Desactivar" : "Reactivar"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
