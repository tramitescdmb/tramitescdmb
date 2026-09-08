"use client";

import { Printer } from "lucide-react";

const ESTILOS = {
  primario: { boton: "bg-cdmb-600 px-4 py-2 text-white hover:bg-cdmb-700", icono: "h-4 w-4" },
  secundario: { boton: "border border-stone-300 bg-white px-3 py-2 text-stone-700 hover:bg-stone-50", icono: "h-3.5 w-3.5" },
};

/** Único botón "Imprimir" del proyecto — llama a window.print() y se oculta a sí mismo al imprimir. Junto
 * a un formulario de una sola pantalla (constancia) usa el estilo "primario" (por defecto); junto a otras
 * acciones secundarias como Descargar CSV (bandeja, expedientes) usa "secundario" para no competir
 * visualmente con la acción principal de la pantalla. */
export function BotonImprimir({ children = "Imprimir", variante = "primario" }: { children?: React.ReactNode; variante?: "primario" | "secundario" }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`inline-flex flex-none items-center gap-1.5 rounded-md text-sm font-medium print:hidden ${ESTILOS[variante].boton}`}
    >
      <Printer className={ESTILOS[variante].icono} aria-hidden />
      {children}
    </button>
  );
}
