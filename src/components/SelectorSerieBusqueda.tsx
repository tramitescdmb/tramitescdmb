"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

type Serie = { id: string; codigo: string; nombre: string; dependencia: { nombre: string } | null };

/**
 * Filtro de serie documental por búsqueda de texto (MoReq 4.7) — reemplaza el desplegable plano que se
 * quitó a pedido del usuario (con 235+ series era peor UX que no tenerlo). Recibe TODAS las series ya
 * cargadas por el propio server component (sin consulta ni API nueva) y filtra en el cliente por código,
 * nombre o dependencia; solo cuando el usuario escribe se calcula y muestra la lista de coincidencias.
 */
export function SelectorSerieBusqueda({ series, valorInicial }: { series: Serie[]; valorInicial?: string }) {
  const inicial = series.find((s) => s.id === valorInicial) ?? null;
  const [seleccionada, setSeleccionada] = useState<Serie | null>(inicial);
  const [texto, setTexto] = useState(inicial ? `${inicial.codigo} — ${inicial.nombre}` : "");
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
    if (!q || seleccionada) return [];
    return series
      .filter((s) => s.codigo.toLowerCase().includes(q) || s.nombre.toLowerCase().includes(q) || (s.dependencia?.nombre.toLowerCase() ?? "").includes(q))
      .slice(0, 8);
  }, [texto, series, seleccionada]);

  return (
    <div ref={ref} className="relative min-w-[220px] flex-1">
      <span className="mb-1 block text-xs font-medium text-stone-600">Serie documental (TRD)</span>
      <span className="flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500">
        <Search className="h-4 w-4 flex-none text-stone-400" aria-hidden />
        <input
          type="text"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setSeleccionada(null);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          placeholder="Buscar por código, nombre o dependencia"
          className="w-full text-sm outline-none"
          autoComplete="off"
        />
        {seleccionada && (
          <button
            type="button"
            onClick={() => {
              setSeleccionada(null);
              setTexto("");
            }}
            className="flex-none text-stone-400 hover:text-stone-600"
            aria-label="Quitar filtro de serie"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </span>
      <input type="hidden" name="serieId" value={seleccionada?.id ?? ""} />
      {abierto && sugerencias.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full min-w-[280px] overflow-y-auto rounded-md border border-stone-200 bg-white py-1 shadow-lg">
          {sugerencias.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setSeleccionada(s);
                  setTexto(`${s.codigo} — ${s.nombre}`);
                  setAbierto(false);
                }}
                className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-cdmb-50"
              >
                <span className="text-stone-800">{s.codigo} — {s.nombre}</span>
                <span className="text-xs text-stone-400">{s.dependencia?.nombre ?? "Sin dependencia asignada"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {abierto && texto.trim() && !seleccionada && sugerencias.length === 0 && (
        <div className="absolute z-10 mt-1 w-full min-w-[280px] rounded-md border border-stone-200 bg-white px-3 py-2 text-xs text-stone-400 shadow-lg">
          Sin coincidencias.
        </div>
      )}
    </div>
  );
}
