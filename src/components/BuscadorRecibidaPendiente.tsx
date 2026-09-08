"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";

type Item = { id: string; label: string };

/**
 * Buscador con autocompletado para elegir una RECIBIDA pendiente de responder — reemplaza un
 * <select> que precargaba hasta 100 opciones (inservible con cientos o miles de radicados: no se
 * podía encontrar uno en particular sin ir desplazando toda la lista).
 */
export function BuscadorRecibidaPendiente({
  valorInicial,
  onChange,
}: {
  valorInicial?: Item | null;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState(valorInicial?.label ?? "");
  const [seleccionado, setSeleccionado] = useState<Item | null>(valorInicial ?? null);
  const [resultados, setResultados] = useState<Item[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const cierreTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!abierto || seleccionado) return;
    const q = query.trim();
    if (q.length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const resp = await fetch(`/api/correspondencia/recibidas-pendientes?q=${encodeURIComponent(q)}`);
        const data = await resp.json();
        setResultados(Array.isArray(data.items) ? data.items : []);
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, abierto, seleccionado]);

  function elegir(item: Item) {
    setSeleccionado(item);
    setQuery(item.label);
    setAbierto(false);
    onChange(item.id);
  }

  function limpiar() {
    setSeleccionado(null);
    setQuery("");
    setResultados([]);
    onChange("");
  }

  return (
    <div className="relative">
      <span className="flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500">
        <Search className="h-4 w-4 flex-none text-stone-400" aria-hidden />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSeleccionado(null);
            onChange("");
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => {
            cierreTimeout.current = setTimeout(() => setAbierto(false), 150);
          }}
          placeholder="Radicado, asunto o tercero…"
          className="w-full border-none p-0 text-sm outline-none"
        />
        {seleccionado && (
          <button type="button" onClick={limpiar} className="flex-none text-stone-400 hover:text-red-600" title="Quitar selección">
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </span>
      {abierto && !seleccionado && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-stone-200 bg-white py-1 shadow-lg">
          {buscando ? (
            <p className="flex items-center gap-2 px-3 py-2 text-sm text-stone-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Buscando…
            </p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-2 text-sm text-stone-400">Sin resultados.</p>
          ) : (
            resultados.map((r) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(r)}
                className="block w-full truncate px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-cdmb-50"
                title={r.label}
              >
                {r.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
