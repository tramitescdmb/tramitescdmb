import { Tags } from "lucide-react";
import { camposMetadatoPara, metadatosIniciales, ETIQUETA_TIPO_CAMPO } from "@/lib/metadatos";

/**
 * Metadatos adicionales de una comunicación (MoReq 5.1/5.6): los campos que un
 * administrador de archivo definió, con sus valores actuales (o el valor por
 * defecto heredado de la serie). Editable por quien distribuye. Server component.
 */
export async function MetadatosComunicacion({
  comunicacionId,
  serieId,
  metadatos,
  puedeEditar,
}: {
  comunicacionId: string;
  serieId: string | null;
  metadatos: Record<string, unknown> | null;
  puedeEditar: boolean;
}) {
  const campos = await camposMetadatoPara("COMUNICACION", serieId);
  if (campos.length === 0) return null;

  const iniciales = metadatosIniciales(campos, metadatos);

  return (
    <section id="metadatos" className="scroll-mt-4 rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
        <Tags className="h-4 w-4 text-cdmb-600" aria-hidden /> Metadatos adicionales
      </h2>

      {puedeEditar ? (
        <form action={`/api/correspondencia/${comunicacionId}/metadatos`} method="post" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {campos.map((c) => (
            <label key={c.clave} className="block text-xs">
              <span className="mb-0.5 block font-medium text-stone-600">
                {c.nombre}
                {c.obligatorio && <span className="text-red-500"> *</span>}
                {c.tipo !== "TEXTO" && <span className="ml-1 font-normal text-stone-400">({ETIQUETA_TIPO_CAMPO[c.tipo]})</span>}
              </span>
              {c.tipo === "LISTA" ? (
                <select name={`m_${c.clave}`} defaultValue={iniciales[c.clave]} required={c.obligatorio} className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm">
                  <option value="">—</option>
                  {c.opciones.map((o) => (<option key={o} value={o}>{o}</option>))}
                </select>
              ) : c.tipo === "BOOLEANO" ? (
                <select name={`m_${c.clave}`} defaultValue={iniciales[c.clave]} className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm">
                  <option value="">—</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  name={`m_${c.clave}`}
                  type={c.tipo === "FECHA" ? "date" : c.tipo === "NUMERO" ? "number" : "text"}
                  step={c.tipo === "NUMERO" ? "any" : undefined}
                  defaultValue={iniciales[c.clave]}
                  required={c.obligatorio}
                  className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
                />
              )}
              {c.ayuda && <span className="mt-0.5 block font-normal text-stone-400">{c.ayuda}</span>}
            </label>
          ))}
          <div className="sm:col-span-2">
            <button className="rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700">Guardar metadatos</button>
          </div>
        </form>
      ) : (
        <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          {campos.map((c) => (
            <div key={c.clave}>
              <dt className="text-stone-400">{c.nombre}</dt>
              <dd className="text-stone-700">
                {iniciales[c.clave] === "" ? "—" : c.tipo === "BOOLEANO" ? (iniciales[c.clave] === "true" ? "Sí" : "No") : iniciales[c.clave]}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
