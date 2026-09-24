"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

type Dependencia = { id: string; nombre: string };

export function BuscadorDependencia({
  dependencias,
  value,
  onChange,
  placeholder = "Buscar dependencia…",
}: {
  dependencias: Dependencia[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const seleccion = useMemo(() => dependencias.find((d) => d.id === value) ?? null, [dependencias, value]);
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const sugerencias = useMemo(() => {
    const q = texto.trim().toLowerCase();
    const lista = q ? dependencias.filter((d) => d.nombre.toLowerCase().includes(q)) : dependencias;
    return lista.slice(0, 20);
  }, [texto, dependencias]);

  return (
    <div ref={ref} className="relative">
      {seleccion ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-cdmb-200 bg-cdmb-50/50 px-3 py-2 text-sm">
          <span className="min-w-0 truncate text-stone-800">{seleccion.nombre}</span>
          <button type="button" onClick={() => onChange("")} className="flex-none text-stone-400 hover:text-stone-600" aria-label="Quitar dependencia">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : (
        <span className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500">
          <Search className="h-4 w-4 flex-none text-stone-400" aria-hidden />
          <input
            type="text"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setAbierto(true);
            }}
            onFocus={() => setAbierto(true)}
            placeholder={placeholder}
            className="w-full text-sm outline-none"
            autoComplete="off"
          />
        </span>
      )}

      {abierto && !seleccion && sugerencias.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full min-w-[280px] overflow-y-auto rounded-md border border-stone-200 bg-white py-1 shadow-lg">
          {sugerencias.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(d.id);
                  setTexto("");
                  setAbierto(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-stone-800 hover:bg-cdmb-50"
              >
                {d.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
      {abierto && !seleccion && texto.trim() && sugerencias.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-xs text-stone-400 shadow-lg">
          Sin coincidencias.
        </div>
      )}
    </div>
  );
}
