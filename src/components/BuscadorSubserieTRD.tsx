"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

type Subserie = { id: string; codigo: string; nombre: string };
export type SerieBuscable = {
  id: string;
  codigo: string;
  nombre: string;
  dependenciaId?: string | null;
  dependenciaNombre?: string | null;
  subseries: Subserie[];
};

type Opcion = {
  serieId: string;
  subserieId: string;
  serie: string;
  subserie: string;
  dependencia: string | null;
  clave: string;
};

/**
 * Selector de clasificación TRD por búsqueda de texto (MoReq 4.7) — reemplaza la
 * cascada de desplegables planos (con cientos de series/subseries era inmanejable,
 * feedback directo del usuario). Se escribe código o nombre de serie/subserie o el
 * de la dependencia y se elige una subserie; la serie se deriva. Puede exponer un
 * `<input hidden name>` (formularios normales) y/o llamar a `onChange`.
 */
export function BuscadorSubserieTRD({
  series,
  serieId,
  subserieId,
  onChange,
  nameSerie,
  nameSubserie,
  dependenciaPreferidaId,
  requerido,
}: {
  series: SerieBuscable[];
  serieId?: string;
  subserieId?: string;
  onChange?: (serieId: string, subserieId: string) => void;
  nameSerie?: string;
  nameSubserie?: string;
  dependenciaPreferidaId?: string | null;
  requerido?: boolean;
}) {
  const opciones = useMemo<Opcion[]>(() => {
    const list: Opcion[] = [];
    for (const s of series) {
      for (const ss of s.subseries) {
        list.push({
          serieId: s.id,
          subserieId: ss.id,
          serie: `${s.codigo} — ${s.nombre}`,
          subserie: `${ss.codigo} — ${ss.nombre}`,
          dependencia: s.dependenciaNombre ?? null,
          clave: `${s.codigo} ${s.nombre} ${ss.codigo} ${ss.nombre} ${s.dependenciaNombre ?? ""}`.toLowerCase(),
        });
      }
    }
    return list;
  }, [series]);

  const seleccion = useMemo(
    () => opciones.find((o) => o.serieId === serieId && o.subserieId === subserieId) ?? null,
    [opciones, serieId, subserieId],
  );

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
    if (!q) return [];
    const match = opciones.filter((o) => q.split(/\s+/).every((t) => o.clave.includes(t)));
    if (dependenciaPreferidaId) {
      const dep = series.find((s) => s.dependenciaId === dependenciaPreferidaId)?.dependenciaNombre?.toLowerCase();
      if (dep) match.sort((a, b) => Number((b.dependencia ?? "").toLowerCase() === dep) - Number((a.dependencia ?? "").toLowerCase() === dep));
    }
    return match.slice(0, 12);
  }, [texto, opciones, dependenciaPreferidaId, series]);

  function elegir(o: Opcion) {
    onChange?.(o.serieId, o.subserieId);
    setTexto("");
    setAbierto(false);
  }
  function limpiar() {
    onChange?.("", "");
    setTexto("");
  }

  return (
    <div ref={ref} className="relative">
      {nameSerie && <input type="hidden" name={nameSerie} value={seleccion?.serieId ?? ""} />}
      {nameSubserie && <input type="hidden" name={nameSubserie} value={seleccion?.subserieId ?? ""} required={requerido} />}

      {seleccion ? (
        <div className="flex items-start justify-between gap-2 rounded-md border border-cdmb-200 bg-cdmb-50/50 px-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="block font-medium text-stone-800">{seleccion.subserie}</span>
            <span className="block text-xs text-stone-500">
              {seleccion.serie}
              {seleccion.dependencia ? ` · ${seleccion.dependencia}` : ""}
            </span>
          </span>
          <button type="button" onClick={limpiar} className="flex-none text-stone-400 hover:text-stone-600" aria-label="Quitar clasificación">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : (
        <span className="flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500">
          <Search className="h-4 w-4 flex-none text-stone-400" aria-hidden />
          <input
            type="text"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setAbierto(true);
            }}
            onFocus={() => setAbierto(true)}
            placeholder="Buscar serie, subserie o dependencia"
            className="w-full text-sm outline-none"
            autoComplete="off"
          />
        </span>
      )}

      {abierto && !seleccion && sugerencias.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full min-w-[320px] overflow-y-auto rounded-md border border-stone-200 bg-white py-1 shadow-lg">
          {sugerencias.map((o) => (
            <li key={o.subserieId}>
              <button
                type="button"
                onClick={() => elegir(o)}
                className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-cdmb-50"
              >
                <span className="text-stone-800">{o.subserie}</span>
                <span className="text-xs text-stone-400">
                  {o.serie}
                  {o.dependencia ? ` · ${o.dependencia}` : ""}
                </span>
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
