"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { OPCIONES_VISTA, type OpcionVista } from "@/lib/vista-lista";

const ETIQUETAS: Record<OpcionVista, string> = {
  "50": "50 registros",
  "100": "100 registros",
  "150": "150 registros",
  "200": "200 registros",
  todos: "Todos los registros",
};

/**
 * "Ver: [50 registros ▾]" — desplegable junto al paginador, al pie de la
 * tabla. Client Component: arma el destino leyendo la URL actual con los
 * hooks de navegación (no puede recibir una función como prop desde el
 * Server Component que lo llama — las funciones no cruzan esa frontera).
 */
export function SelectorVista({ vistaActual }: { vistaActual: OpcionVista }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function cambiarVista(v: OpcionVista) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("vista", v);
    params.delete("page"); // el tamaño cambió: vuelve a la página 1
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-4 py-2.5 text-sm">
      <label htmlFor="selector-vista" className="text-xs text-stone-500">
        Ver:
      </label>
      <select
        id="selector-vista"
        value={vistaActual}
        onChange={(e) => cambiarVista(e.target.value as OpcionVista)}
        className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
      >
        {OPCIONES_VISTA.map((v) => (
          <option key={v} value={v}>
            {ETIQUETAS[v]}
          </option>
        ))}
      </select>
    </div>
  );
}
