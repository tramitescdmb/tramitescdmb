import type { ReactNode } from "react";
import { Clock, Landmark } from "lucide-react";
import type { Categoria } from "@/lib/tramite-categoria";

/** Marco común de la tarjeta de trámite (catálogo interno y vista pública «Solicitud ambiental»). */
export const CLASE_TARJETA_TRAMITE =
  "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 pt-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-soft-lg active:translate-y-0 active:scale-[0.98] active:shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-cdmb-400";

/**
 * Contenido de la tarjeta: franja de color, cuadro con el ícono del recurso, categoría, nombre,
 * fichas SUIT, tiempo estimado y descripción. `codigo` solo se muestra en el catálogo interno.
 */
export function CuerpoTarjetaTramite({
  clases,
  etiqueta,
  icono,
  nombre,
  suits,
  descripcion,
  diasEstimados,
  codigo,
}: {
  clases: Categoria["clases"];
  etiqueta: string;
  icono: ReactNode;
  nombre: string;
  suits: string[];
  descripcion: string;
  diasEstimados: number | null;
  codigo?: string;
}) {
  return (
    <>
      <span className={`absolute inset-x-0 top-0 h-1.5 ${clases.barra}`} aria-hidden />

      {(codigo || diasEstimados !== null) && (
        <span className="mb-3 flex items-center justify-between gap-2">
          {codigo ? <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-500">{codigo}</span> : <span />}
          {diasEstimados !== null &&
            (diasEstimados > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500">
                <Clock className="h-3 w-3" aria-hidden />~{diasEstimados} días
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-stone-400" title="El procedimiento oficial no especifica tiempos por actividad">
                <Clock className="h-3 w-3" aria-hidden />
                sin tiempo especificado
              </span>
            ))}
        </span>
      )}

      <span className="mb-2 flex items-start gap-3">
        <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${clases.icono}`} title={etiqueta} aria-hidden>
          {icono}
        </span>
        <span className="min-w-0">
          <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${clases.badge}`}>{etiqueta}</span>
          <span role="heading" aria-level={3} className="mt-1 block font-semibold leading-snug text-stone-900 transition group-hover:text-cdmb-700">{nombre}</span>
        </span>
      </span>

      {suits.length > 0 && (
        <span className="mb-2 flex flex-wrap gap-1.5">
          {suits.map((numero) => (
            <span
              key={numero}
              className="inline-flex items-center gap-1 rounded-sm bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500"
              title={`Inscrito en el SUIT (Sistema Único de Información de Trámites), ficha ${numero}.`}
            >
              <Landmark className="h-3 w-3" aria-hidden />
              SUIT {numero}
            </span>
          ))}
        </span>
      )}

      <span className="block flex-1 text-sm text-stone-500">{descripcion}</span>
    </>
  );
}
