"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";

export type OpcionTramiteNuevo = {
  clave: string;
  href: string;
  nombre: string;
  codigo: string;
  suits: string[];
  categoria: string;
  ordenCategoria: number;
};

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function SelectorTramiteNuevo({ opciones }: { opciones: OpcionTramiteNuevo[] }) {
  const [texto, setTexto] = useState("");
  const filtradas = useMemo(() => {
    const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return opciones;
    return opciones.filter((o) => {
      const base = normalizar([o.nombre, o.codigo, o.categoria, ...o.suits].join(" "));
      return palabras.every((p) => base.includes(p));
    });
  }, [texto, opciones]);

  return (
    <div className="space-y-3">
      <label className="relative block">
        <span className="sr-only">Buscar trámite</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && filtradas.length === 1) window.location.assign(filtradas[0]!.href);
          }}
          placeholder="Buscar por nombre, código o número SUIT"
          className="w-full rounded-md border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        />
      </label>

      {filtradas.length === 0 ? (
        <p className="rounded-md border border-dashed border-stone-200 p-4 text-center text-sm text-stone-500">Ningún trámite coincide con la búsqueda.</p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-md border border-stone-200 bg-white">
          {filtradas.map((o) => (
            <li key={o.clave}>
              <Link prefetch={false} href={o.href} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-cdmb-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-stone-800">{o.nombre}</span>
                  <span className="block truncate text-xs text-stone-500">
                    {o.categoria} · {o.codigo}
                    {o.suits.length > 0 && ` · SUIT ${o.suits.join(", ")}`}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 flex-none text-stone-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
