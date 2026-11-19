import type { ReactNode } from "react";
import { Clock, Landmark } from "lucide-react";
import type { Categoria } from "@/lib/tramite-categoria";

/** Marco común de la tarjeta de trámite (catálogo interno y vista pública «Solicitud ambiental»). */
export const CLASE_TARJETA_TRAMITE =
  "group relative flex h-full flex-col overflow-hidden rounded-xl border border-stone-200 bg-white p-3.5 pt-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-soft-lg active:translate-y-0 active:scale-[0.98] active:shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-cdmb-400";

/**
 * Contenido de la tarjeta, compacto: franja de color; fila con el cuadro del ícono, la categoría, las fichas
 * SUIT y el tiempo estimado; el nombre a todo el ancho y la descripción en máximo tres líneas (completa al
 * pasar el cursor). `codigo` solo se muestra en el catálogo interno.
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
      <span className={`absolute inset-x-0 top-0 h-1 ${clases.barra}`} aria-hidden />

      <span className="flex items-start gap-2.5">
        <span
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg [&>svg]:h-5 [&>svg]:w-5 ${clases.icono}`}
          title={etiqueta}
          aria-hidden
        >
          {icono}
        </span>
        <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span className={`max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${clases.badge}`}>{etiqueta}</span>
          <span className="flex w-full flex-wrap items-center gap-1">
            {codigo && <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-500">{codigo}</span>}
            {suits.map((numero) => (
              <span
                key={numero}
                className="inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500"
                title={`Inscrito en el SUIT (Sistema Único de Información de Trámites), ficha ${numero}.`}
              >
                <Landmark className="h-2.5 w-2.5" aria-hidden />
                SUIT {numero}
              </span>
            ))}
            {diasEstimados !== null &&
              (diasEstimados > 0 ? (
                <span className="ml-auto inline-flex flex-none items-center gap-1 text-[11px] font-medium text-stone-500" title="Tiempo estimado del procedimiento">
                  <Clock className="h-3 w-3" aria-hidden />~{diasEstimados} días
                </span>
              ) : (
                <span className="ml-auto inline-flex flex-none items-center gap-1 text-[11px] text-stone-400" title="El procedimiento oficial no especifica tiempos por actividad">
                  <Clock className="h-3 w-3" aria-hidden />
                  sin tiempo
                </span>
              ))}
          </span>
        </span>
      </span>

      <span
        role="heading"
        aria-level={3}
        className="mt-2.5 block text-[15px] font-semibold leading-snug text-stone-900 transition group-hover:text-cdmb-700"
      >
        {nombre}
      </span>

      <span className="mt-1 block flex-1">
        <span className="line-clamp-3 text-[13px] leading-snug text-stone-500" title={descripcion}>
          {descripcion}
        </span>
      </span>
    </>
  );
}
