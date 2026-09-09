import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Tags, Plus, Trash2 } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { listarCamposMetadato, ETIQUETA_TIPO_CAMPO, ETIQUETA_AMBITO_CAMPO } from "@/lib/metadatos";
import { listarSeriesVigentes } from "@/lib/trd";
import { registrarAccesoDenegadoSeccion } from "@/lib/auditoria-doc";
import { Field, SectionHelp } from "@/components/Field";
import { TituloSeccion, EstadoVacio } from "@/components/sgdea/ui";

const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";
const TIPOS = ["TEXTO", "NUMERO", "FECHA", "LISTA", "BOOLEANO"] as const;
const AMBITOS = ["AMBOS", "COMUNICACION", "EXPEDIENTE"] as const;

export default async function CamposMetadatoPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoSeccion("Campos de metadato", session, await headers());
    redirect("/correspondencia");
  }

  const sp = await searchParams;
  const [campos, series] = await Promise.all([listarCamposMetadato(), listarSeriesVigentes()]);

  return (
    <div className="space-y-6">
      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <div className="space-y-2">
        <TituloSeccion icon={Tags}>Campos de metadato adicionales</TituloSeccion>
        <SectionHelp>
          Amplían la ficha de una comunicación o un expediente más allá de los campos de fábrica
          (MoReq 5.1/5.2). Se llenan desde el detalle de cada comunicación. Si asocia el campo a una{" "}
          <strong>serie</strong>, solo aparece para lo clasificado en ella y su valor por defecto se hereda.
        </SectionHelp>
      </div>

      <details className="rounded-xl border border-stone-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-stone-900">Crear un campo</summary>
        <form action="/api/correspondencia/metadatos" method="post" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Nombre" required>
              <input name="nombre" className={inputCls} placeholder="Ej. Número de predio" required />
            </Field>
          </div>
          <Field label="Tipo">
            <select name="tipo" className={inputCls} defaultValue="TEXTO">
              {TIPOS.map((t) => (<option key={t} value={t}>{ETIQUETA_TIPO_CAMPO[t]}</option>))}
            </select>
          </Field>
          <Field label="Ámbito" help="Dónde aparece el campo.">
            <select name="ambito" className={inputCls} defaultValue="AMBOS">
              {AMBITOS.map((a) => (<option key={a} value={a}>{ETIQUETA_AMBITO_CAMPO[a]}</option>))}
            </select>
          </Field>
          <Field label="Serie (opcional)" help="Si se elige, el campo solo aplica a lo clasificado en esa serie.">
            <select name="serieId" className={inputCls} defaultValue="">
              <option value="">— Todas —</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.codigo} — {s.nombre}{s.dependencia ? ` (${s.dependencia.nombre})` : ""}</option>
              ))}
            </select>
          </Field>
          <Field label="Valor por defecto" help="Se hereda como valor inicial (útil con una serie).">
            <input name="valorPorDefecto" className={inputCls} />
          </Field>
          <div className="sm:col-span-3">
            <Field label="Opciones (solo tipo lista)" help="Una por línea, o separadas por coma.">
              <textarea name="opciones" rows={2} className={inputCls} placeholder={"Urbano\nRural"} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-3">
            <input type="checkbox" name="obligatorio" className="rounded border-stone-300" /> Obligatorio
          </label>
          <div className="sm:col-span-3">
            <button className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Crear campo
            </button>
          </div>
        </form>
      </details>

      {campos.length === 0 ? (
        <EstadoVacio icon={Tags}>Todavía no hay campos de metadato adicionales.</EstadoVacio>
      ) : (
        <div className="space-y-2">
          {campos.map((c) => (
            <details key={c.id} className={`rounded-xl border border-stone-200 bg-white p-4 ${c.activo ? "" : "opacity-60"}`}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium text-stone-800">
                {c.nombre}
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-normal text-stone-500">{ETIQUETA_TIPO_CAMPO[c.tipo]}</span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-normal text-stone-500">{ETIQUETA_AMBITO_CAMPO[c.ambito]}</span>
                {c.serie && <span className="rounded-full bg-cdmb-50 px-2 py-0.5 text-[11px] font-normal text-cdmb-700">Serie {c.serie.codigo}</span>}
                {c.obligatorio && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-normal text-amber-700">Obligatorio</span>}
                {!c.activo && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-normal text-stone-500">Inactivo</span>}
              </summary>
              <form action={`/api/correspondencia/metadatos/${c.id}`} method="post" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input type="hidden" name="accion" value="editar" />
                <div className="sm:col-span-2">
                  <Field label="Nombre" required><input name="nombre" defaultValue={c.nombre} className={inputCls} required /></Field>
                </div>
                <Field label="Ámbito">
                  <select name="ambito" defaultValue={c.ambito} className={inputCls}>
                    {AMBITOS.map((a) => (<option key={a} value={a}>{ETIQUETA_AMBITO_CAMPO[a]}</option>))}
                  </select>
                </Field>
                <Field label="Serie">
                  <select name="serieId" defaultValue={c.serieId ?? ""} className={inputCls}>
                    <option value="">— Todas —</option>
                    {series.map((s) => (<option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>))}
                  </select>
                </Field>
                <Field label="Valor por defecto"><input name="valorPorDefecto" defaultValue={c.valorPorDefecto ?? ""} className={inputCls} /></Field>
                <div className="sm:col-span-3">
                  <Field label="Ayuda"><input name="ayuda" defaultValue={c.ayuda ?? ""} className={inputCls} /></Field>
                </div>
                {c.tipo === "LISTA" && (
                  <div className="sm:col-span-3">
                    <Field label="Opciones"><textarea name="opciones" rows={2} defaultValue={c.opciones.join("\n")} className={inputCls} /></Field>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-3">
                  <input type="checkbox" name="obligatorio" defaultChecked={c.obligatorio} className="rounded border-stone-300" /> Obligatorio
                </label>
                <div className="sm:col-span-3 flex flex-wrap items-center gap-4">
                  <button className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">Guardar</button>
                </div>
              </form>
              <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-stone-100 pt-2">
                <form action={`/api/correspondencia/metadatos/${c.id}`} method="post">
                  <input type="hidden" name="accion" value="toggle" />
                  <input type="hidden" name="activo" value={c.activo ? "false" : "true"} />
                  <button className="text-xs font-medium text-cdmb-700 hover:underline">{c.activo ? "Desactivar" : "Reactivar"}</button>
                </form>
                <form action={`/api/correspondencia/metadatos/${c.id}`} method="post">
                  <input type="hidden" name="accion" value="eliminar" />
                  <button className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline">
                    <Trash2 className="h-3 w-3" aria-hidden /> Eliminar
                  </button>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
