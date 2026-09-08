"use client";

import { Printer } from "lucide-react";

/** Imprime la lista de resultados tal como está filtrada en pantalla (MoReq 4.9) — el layout (nav, filtros,
 * botones, paginación) se oculta vía print:hidden en cada página; solo queda el encabezado de contexto y
 * la tabla de resultados. Se oculta a sí mismo al imprimir (print:hidden), como el resto de los controles. */
export function ImprimirBoton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex flex-none items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
    >
      <Printer className="h-3.5 w-3.5" aria-hidden />
      Imprimir
    </button>
  );
}
