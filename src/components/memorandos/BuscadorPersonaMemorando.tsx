"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export type PersonaBuscable = { id: string; nombre: string; cargo: string; dependenciaNombre?: string | null; dirige?: boolean };

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const MAX_RESULTADOS = 40;

/**
 * Buscador de personas para el memorando (PARA, Proyectó, Revisó). Al enfocarlo lista los disponibles;
 * al escribir filtra por nombre, cargo u oficina. Pensado para cuando haya muchos funcionarios.
 */
export function BuscadorPersonaMemorando({
  personas,
  valor,
  onChange,
  placeholder = "Buscar por nombre, cargo u oficina…",
  vacio = "No hay personas disponibles.",
  permitirQuitar = true,
  deshabilitado = false,
}: {
  personas: PersonaBuscable[];
  valor: string;
  onChange: (id: string) => void;
  placeholder?: string;
  vacio?: string;
  permitirQuitar?: boolean;
  deshabilitado?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const listaId = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const seleccion = personas.find((p) => p.id === valor) ?? null;
  const q = normalizar(texto.trim());
  const coincidentes = useMemo(
    () => (q ? personas.filter((p) => normalizar(`${p.nombre} ${p.cargo} ${p.dependenciaNombre ?? ""}`).includes(q)) : personas),
    [personas, q]
  );

  if (seleccion) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm">
        <span className="min-w-0">
          <span className="block truncate font-medium text-stone-800">{seleccion.nombre}</span>
          <span className="block truncate text-[11px] text-stone-500">
            {seleccion.cargo}
            {seleccion.dependenciaNombre ? ` · ${seleccion.dependenciaNombre}` : ""}
          </span>
        </span>
        {permitirQuitar && !deshabilitado && (
          <button type="button" onClick={() => onChange("")} aria-label={`Quitar a ${seleccion.nombre}`} className="flex-none rounded-full p-0.5 text-stone-400 hover:bg-stone-200 hover:text-red-600">
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={contenedor}
      className="relative"
      onBlur={(e) => {
        if (!contenedor.current?.contains(e.relatedTarget as Node | null)) setAbierto(false);
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          type="search"
          value={texto}
          disabled={deshabilitado}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setAbierto(false);
            if (e.key === "Enter") {
              e.preventDefault();
              if (coincidentes.length === 1) {
                onChange(coincidentes[0]!.id);
                setTexto("");
                setAbierto(false);
              }
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-expanded={abierto}
          aria-controls={listaId}
          role="combobox"
          className="w-full rounded-md border border-stone-200 py-2 pl-8 pr-3 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500 disabled:bg-stone-50"
        />
      </div>
      {abierto && !deshabilitado && (
        <div id={listaId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg">
          {coincidentes.length === 0 ? (
            <p className="px-3 py-2 text-xs text-stone-400">{q ? "Ninguna persona coincide." : vacio}</p>
          ) : (
            <>
              {coincidentes.slice(0, MAX_RESULTADOS).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    onChange(p.id);
                    setTexto("");
                    setAbierto(false);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-50 focus:bg-stone-50 focus:outline-none"
                >
                  <span className="font-medium">{p.nombre}</span>
                  {p.dirige && <span className="ml-1.5 rounded bg-cdmb-50 px-1 text-[10px] font-semibold uppercase text-cdmb-700">Dirige</span>}
                  <span className="block text-[11px] text-stone-500">
                    {p.cargo}
                    {p.dependenciaNombre ? ` · ${p.dependenciaNombre}` : ""}
                  </span>
                </button>
              ))}
              {coincidentes.length > MAX_RESULTADOS && (
                <p className="border-t border-stone-100 px-3 py-1.5 text-[11px] text-stone-400">
                  Hay {coincidentes.length - MAX_RESULTADOS} más: escriba para afinar la búsqueda.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
