"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { sinTildes } from "@/lib/divipola";

export type PersonaRol = { id: string; nombre: string; dependenciaNombre?: string | null; identificacion?: string | null };

export function SelectorPersonasPorRol({
  personas,
  seleccionados,
  onAlternar,
  nombreRol,
  claseCampo,
}: {
  personas: PersonaRol[];
  seleccionados: Set<string>;
  onAlternar: (id: string) => void;
  nombreRol: string;
  claseCampo: string;
}) {
  const [filtro, setFiltro] = useState("");
  const [dependencia, setDependencia] = useState("");
  const dependencias = Array.from(new Set(personas.map((p) => p.dependenciaNombre).filter((d): d is string => Boolean(d)))).sort((a, b) =>
    a.localeCompare(b, "es")
  );
  const palabras = sinTildes(filtro).split(/\s+/).filter(Boolean);
  const buscando = palabras.length > 0 || Boolean(dependencia);
  const coincide = (p: PersonaRol) => {
    const texto = sinTildes(`${p.nombre} ${p.identificacion ?? ""}`);
    return palabras.every((w) => texto.includes(w)) && (!dependencia || p.dependenciaNombre === dependencia);
  };
  const visibles = personas.filter((p) => seleccionados.has(p.id) || (buscando && coincide(p)));

  return (
    <div className="space-y-2">
      <div className={`grid gap-2 ${dependencias.length > 1 ? "sm:grid-cols-2" : ""}`}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
          <input
            type="text"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por nombre o documento…"
            aria-label={`Buscar ${nombreRol}`}
            className={`${claseCampo} pl-9`}
          />
        </div>
        {dependencias.length > 1 && (
          <select value={dependencia} onChange={(e) => setDependencia(e.target.value)} aria-label="Filtrar por dependencia" className={claseCampo}>
            <option value="">Todas las dependencias</option>
            {dependencias.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>

      {visibles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visibles.map((p) => {
            const activo = seleccionados.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onAlternar(p.id)}
                aria-pressed={activo}
                title={p.dependenciaNombre ?? undefined}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                  activo ? "border-menu-500 bg-menu-500 text-stone-900 shadow-sm" : "border-stone-200 bg-white text-stone-600 hover:border-cdmb-300 hover:bg-cdmb-50"
                }`}
              >
                {p.nombre}
              </button>
            );
          })}
        </div>
      )}

      {!buscando && seleccionados.size === 0 && (
        <p className="text-xs text-stone-400">
          {personas.length === 0 ? `Ningún usuario activo tiene el rol ${nombreRol}.` : "Escriba un nombre o elija una dependencia para buscar."}
        </p>
      )}
      {buscando && !personas.some(coincide) && (
        <p className="text-xs text-stone-400">Ninguna persona con el rol {nombreRol} coincide con la búsqueda.</p>
      )}
      {seleccionados.size > 0 && (
        <p className="text-xs font-medium text-cdmb-700">
          {seleccionados.size} persona{seleccionados.size === 1 ? "" : "s"} seleccionada{seleccionados.size === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
