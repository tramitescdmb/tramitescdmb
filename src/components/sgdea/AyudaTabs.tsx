"use client";

import { useState, type ReactNode } from "react";

/**
 * Agrupa el documento de referencia del SGDEA en pestañas para que no sea un
 * scroll interminable. En pantalla se ve un grupo a la vez; al imprimir se
 * expanden todos (cada panel es `hidden print:block` cuando no está activo), así
 * el documento impreso sigue completo.
 */
export function AyudaTabs({
  grupos,
}: {
  grupos: { id: string; label: string; contenido: ReactNode }[];
}) {
  const [activo, setActivo] = useState(grupos[0]?.id ?? "");

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Secciones del documento"
        className="flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-white p-1 print:hidden"
      >
        {grupos.map((g) => {
          const sel = g.id === activo;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => setActivo(g.id)}
              className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                sel ? "bg-cdmb-600 text-white" : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {grupos.map((g) => (
        <div
          key={g.id}
          role="tabpanel"
          aria-label={g.label}
          className={`space-y-4 ${g.id === activo ? "" : "hidden print:block"}`}
        >
          {g.contenido}
        </div>
      ))}
    </div>
  );
}
