import { OPCIONES_VISTA, type OpcionVista } from "@/lib/vista-lista";

/** "Ver: 50 · 100 · 150 · 200 · Todos" — va junto al paginador, al pie de la tabla. */
export function SelectorVista({ vistaActual, hrefVista }: { vistaActual: OpcionVista; hrefVista: (vista: OpcionVista) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-stone-100 px-4 py-2.5 text-sm">
      <span className="text-xs text-stone-400">Ver:</span>
      {OPCIONES_VISTA.map((v) => (
        <a
          key={v}
          href={hrefVista(v)}
          aria-current={v === vistaActual ? "true" : undefined}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
            v === vistaActual
              ? "border-cdmb-600 bg-cdmb-600 text-white"
              : "border-stone-300 text-stone-700 hover:bg-stone-50"
          }`}
        >
          {v === "todos" ? "Todos" : v}
        </a>
      ))}
    </div>
  );
}
