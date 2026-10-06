"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { filtrarExpedientes } from "@/lib/planeador";
import type { ExpedienteParaVisita } from "@/components/planeador/ProgramarVisitaForm";

const MAX_RESULTADOS = 40;

export function BuscadorExpediente({
  expedientes,
  seleccionado,
  onSeleccionar,
}: {
  expedientes: ExpedienteParaVisita[];
  seleccionado: ExpedienteParaVisita | undefined;
  onSeleccionar: (id: string) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(!seleccionado);
  const [activo, setActivo] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const idLista = useId();

  const resultados = useMemo(() => {
    const filtrados = filtrarExpedientes(expedientes, consulta);
    return [...filtrados.filter((e) => e.porProgramar), ...filtrados.filter((e) => !e.porProgramar)];
  }, [expedientes, consulta]);
  const visibles = resultados.slice(0, MAX_RESULTADOS);

  function elegir(e: ExpedienteParaVisita) {
    onSeleccionar(e.id);
    setConsulta("");
    setAbierto(false);
  }

  if (seleccionado && !abierto) {
    return (
      <div className="mt-0.5 flex items-start justify-between gap-2 rounded-md border border-cdmb-200 bg-cdmb-50/60 px-2.5 py-2">
        <div className="min-w-0 text-xs">
          <p className="font-semibold text-stone-900">{seleccionado.numero}</p>
          <p className="truncate text-stone-600">{seleccionado.tramite}</p>
          <p className="truncate text-stone-500">
            {seleccionado.solicitante} · {seleccionado.municipio}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAbierto(true);
            requestAnimationFrame(() => entrada.current?.focus());
          }}
          className="flex-none rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="relative mt-0.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          ref={entrada}
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls={idLista}
          aria-activedescendant={visibles[activo] ? `${idLista}-${visibles[activo]!.id}` : undefined}
          autoFocus
          value={consulta}
          onChange={(e) => {
            setConsulta(e.target.value);
            setActivo(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActivo((a) => Math.min(a + 1, visibles.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActivo((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (visibles[activo]) elegir(visibles[activo]!);
            } else if (e.key === "Escape" && seleccionado) {
              e.preventDefault();
              setAbierto(false);
            }
          }}
          placeholder="Número, tipo de trámite, solicitante, NIT/cédula, municipio…"
          className="w-full rounded-md border border-stone-200 py-1.5 pl-8 pr-8 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
        />
        {seleccionado && (
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label="Conservar el trámite seleccionado"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
      <ul id={idLista} role="listbox" className="mt-1 max-h-56 overflow-y-auto rounded-md border border-stone-200 bg-white shadow-sm">
        {visibles.length === 0 ? (
          <li className="px-3 py-2 text-xs text-stone-400">Ningún trámite en ejecución coincide con la búsqueda.</li>
        ) : (
          visibles.map((e, i) => (
            <li key={e.id} id={`${idLista}-${e.id}`} role="option" aria-selected={i === activo}>
              <button
                type="button"
                onMouseEnter={() => setActivo(i)}
                onClick={() => elegir(e)}
                className={`block w-full px-3 py-1.5 text-left text-xs ${i === activo ? "bg-cdmb-50" : ""}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-stone-900">{e.numero}</span>
                  {e.porProgramar ? (
                    <span className="flex-none rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">Por programar</span>
                  ) : (
                    <span className="flex-none rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">Con visita</span>
                  )}
                </span>
                <span className="block truncate text-stone-600">{e.tramite}</span>
                <span className="block truncate text-stone-400">
                  {e.solicitante} · {e.identificacion} · {e.municipio}
                </span>
              </button>
            </li>
          ))
        )}
        {resultados.length > MAX_RESULTADOS && (
          <li className="border-t border-stone-100 px-3 py-1.5 text-[11px] text-stone-400">
            {resultados.length - MAX_RESULTADOS} resultados más. Refine la búsqueda.
          </li>
        )}
      </ul>
    </div>
  );
}
