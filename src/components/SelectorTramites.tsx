"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ListFilter, X } from "lucide-react";

type Opcion = { valor: string; etiqueta: string; total?: number };

export function SelectorTramites({
  opciones,
  paramName = "tramite",
  titulo = "Trámites",
}: {
  opciones: Opcion[];
  paramName?: string;
  titulo?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seleccionActual = useMemo(
    () => new Set((searchParams.get(paramName) ?? "").split(",").filter(Boolean)),
    [searchParams, paramName]
  );
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(seleccionActual);

  const filtradas = texto.trim() ? opciones.filter((o) => o.etiqueta.toLowerCase().includes(texto.trim().toLowerCase())) : opciones;

  function alternar(valor: string) {
    const nueva = new Set(seleccion);
    if (nueva.has(valor)) nueva.delete(valor);
    else nueva.add(valor);
    setSeleccion(nueva);
  }

  function irA(nueva: Set<string>) {
    const params = new URLSearchParams(searchParams.toString());
    if (nueva.size > 0) params.set(paramName, Array.from(nueva).join(","));
    else params.delete(paramName);
    router.push(`${pathname}?${params.toString()}`);
    setAbierto(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setSeleccion(seleccionActual);
          setTexto("");
          setAbierto((a) => !a);
        }}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
          seleccionActual.size > 0 ? "border-cdmb-300 bg-cdmb-50 text-cdmb-700" : "border-stone-200 text-stone-600 hover:bg-stone-50"
        }`}
      >
        <ListFilter className="h-3.5 w-3.5" aria-hidden />
        {titulo}
        {seleccionActual.size > 0 && <span className="rounded-full bg-cdmb-600 px-1.5 text-xs text-white">{seleccionActual.size}</span>}
      </button>
      {abierto && (
        <div className="absolute z-20 mt-1.5 w-72 rounded-xl border border-stone-200 bg-white p-3 shadow-lg">
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar…"
            className="mb-2 w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm text-stone-700 focus:border-vivo-500 focus:outline-none focus:ring-4 focus:ring-vivo-500/15"
          />
          <div className="max-h-60 space-y-0.5 overflow-y-auto">
            {filtradas.length === 0 && <p className="px-1 py-2 text-xs text-stone-400">Sin coincidencias.</p>}
            {filtradas.map((o) => (
              <label key={o.valor} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-stone-50">
                <input
                  type="checkbox"
                  checked={seleccion.has(o.valor)}
                  onChange={() => alternar(o.valor)}
                  className="h-3.5 w-3.5 rounded border-stone-300 text-cdmb-600 focus:ring-vivo-500"
                />
                <span className="flex-1 truncate text-stone-700">{o.etiqueta}</span>
                {o.total != null && <span className="text-xs text-stone-400">{o.total}</span>}
              </label>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-stone-100 pt-2">
            <button type="button" onClick={() => irA(new Set())} className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700">
              <X className="h-3 w-3" aria-hidden />
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => irA(seleccion)}
              className="rounded-lg bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600"
            >
              Aplicar ({seleccion.size})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
