"use client";

import { useState } from "react";

type DocumentoRequerido = {
  id: string;
  orden: number;
  nombre: string;
  obligatorio: boolean;
  notas: string | null;
  aplicaA: "NATURAL" | "JURIDICA" | null;
};

const FILTROS = [
  { id: "TODOS", etiqueta: "Todos" },
  { id: "NATURAL", etiqueta: "Persona natural" },
  { id: "JURIDICA", etiqueta: "Persona jurídica" },
] as const;

/**
 * Antes mostraba los 13-14 documentos siempre expandidos, todos juntos —
 * para alguien que ya sabe que es persona natural, tener que leer también
 * los 3-4 que solo aplican a persona jurídica (y viceversa) era ruido. El
 * filtro reutiliza el mismo patrón de píldoras del catálogo.
 */
export function DocumentosParaRadicar({
  documentos,
  claseIcono,
}: {
  documentos: DocumentoRequerido[];
  claseIcono: string;
}) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("TODOS");
  const visibles = documentos.filter((d) => filtro === "TODOS" || d.aplicaA === null || d.aplicaA === filtro);
  const obligatoriosVisibles = visibles.filter((d) => d.obligatorio).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-900">
          Documentos para radicar
          <span className="ml-2 font-normal text-stone-400">
            ({obligatoriosVisibles} obligatorios de {visibles.length})
          </span>
        </h2>
        <div className="flex gap-1" role="group" aria-label="Filtrar documentos por tipo de solicitante">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filtro === f.id ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
      </div>
      <ol className="space-y-2">
        {visibles.map((d) => (
          <li key={d.id} className="flex items-start gap-3 rounded-lg bg-stone-50 p-3">
            <span
              className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-semibold ${claseIcono}`}
            >
              {d.orden}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium text-stone-800">{d.nombre}</span>
                {d.obligatorio ? (
                  <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                    Obligatorio
                    {d.aplicaA === "JURIDICA" ? " · solo persona jurídica" : d.aplicaA === "NATURAL" ? " · solo persona natural" : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                    Opcional
                  </span>
                )}
              </div>
              {d.notas && <p className="mt-0.5 text-xs text-stone-500">{d.notas}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
