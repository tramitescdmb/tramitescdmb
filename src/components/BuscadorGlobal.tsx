"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { IconSearch, IconLoader2 } from "@tabler/icons-react";
import type { GrupoBusqueda } from "@/lib/busqueda-global";

export function BuscadorGlobal() {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [grupos, setGrupos] = useState<GrupoBusqueda[]>([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [indice, setIndice] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const listaId = useId();

  const planos = grupos.flatMap((g) => g.resultados.map((r) => ({ ...r, grupo: g.modulo })));

  useEffect(() => {
    setAbierto(false);
    setQ("");
  }, [pathname]);

  useEffect(() => {
    const termino = q.trim();
    if (termino.length < 2) {
      setGrupos([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const control = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/buscar?q=${encodeURIComponent(termino)}`, { signal: control.signal });
        const body = await res.json();
        setGrupos(res.ok ? body.grupos : []);
        setIndice(-1);
      } catch {
        if (!control.signal.aborted) setGrupos([]);
      } finally {
        if (!control.signal.aborted) setCargando(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      control.abort();
    };
  }, [q]);

  useEffect(() => {
    function atajo(e: KeyboardEvent) {
      const destino = e.target as HTMLElement;
      const escribiendo = destino.closest("input, textarea, select, [contenteditable=true]");
      if (e.key === "/" && !escribiendo) {
        e.preventDefault();
        input.current?.focus();
      }
    }
    function fuera(e: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("keydown", atajo);
    document.addEventListener("mousedown", fuera);
    return () => {
      document.removeEventListener("keydown", atajo);
      document.removeEventListener("mousedown", fuera);
    };
  }, []);

  function alTeclado(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setIndice((i) => Math.min(i + 1, planos.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      const elegido = planos[indice] ?? planos[0];
      if (elegido) {
        e.preventDefault();
        router.push(elegido.href);
      }
    } else if (e.key === "Escape") {
      setAbierto(false);
      input.current?.blur();
    }
  }

  const mostrar = abierto && q.trim().length >= 2;
  let posicion = -1;

  return (
    <div ref={contenedor} className="relative w-full max-w-md">
      <div className="flex h-10 items-center rounded border border-stone-300 bg-white focus-within:border-vivo-500 focus-within:ring-1 focus-within:ring-vivo-500">
        <input
          ref={input}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={alTeclado}
          placeholder="Buscar expediente, contrato, radicado o solicitante…"
          aria-label="Búsqueda global"
          aria-expanded={mostrar}
          aria-controls={listaId}
          role="combobox"
          aria-autocomplete="list"
          className="h-full min-w-0 flex-1 rounded-l border-0 bg-transparent px-3 text-sm text-stone-800 placeholder:text-stone-400 focus:!border-0 focus:!shadow-none focus:outline-none"
        />
        <span className="flex h-full w-10 flex-none items-center justify-center text-stone-500" aria-hidden>
          {cargando ? <IconLoader2 className="h-5 w-5 animate-spin" stroke={1.75} /> : <IconSearch className="h-5 w-5" stroke={1.75} />}
        </span>
      </div>

      {mostrar && (
        <div id={listaId} role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[70vh] overflow-y-auto rounded-md border border-stone-200 bg-white shadow-soft-lg">
          {!cargando && grupos.length === 0 && <p className="px-4 py-6 text-center text-sm text-stone-400">Sin resultados para «{q.trim()}».</p>}
          {grupos.map((g) => (
            <div key={g.modulo} className="border-b border-stone-100 last:border-b-0">
              <p className="flex items-center justify-between bg-stone-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                {g.titulo}
                <a href={g.verTodos} className="font-medium normal-case tracking-normal text-cdmb-700 hover:underline">
                  Ver todos
                </a>
              </p>
              <ul>
                {g.resultados.map((r) => {
                  posicion += 1;
                  const sel = posicion === indice;
                  return (
                    <li key={r.href} role="option" aria-selected={sel}>
                      <a href={r.href} className={`block px-4 py-2 text-sm ${sel ? "bg-cdmb-50" : "hover:bg-stone-50"}`}>
                        <span className="block truncate font-medium text-stone-800">{r.titulo}</span>
                        {r.detalle && <span className="block truncate text-xs text-stone-500">{r.detalle}</span>}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
