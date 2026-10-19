"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type GrupoPestana = { id: string; label: string; icono?: ReactNode; contador?: number; oculta?: boolean; contenido: ReactNode };

export function PestanasDetalle({
  grupos,
  inicial,
  etiqueta = "Secciones del detalle",
}: {
  grupos: GrupoPestana[];
  inicial?: string;
  etiqueta?: string;
}) {
  const visibles = grupos.filter((g) => !g.oculta);
  const [activo, setActivo] = useState(inicial && visibles.some((g) => g.id === inicial) ? inicial : (visibles[0]?.id ?? ""));
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function irAlAncla() {
      const ancla = decodeURIComponent(window.location.hash.slice(1));
      if (!ancla || !contenedor.current) return;
      const destino = document.getElementById(ancla);
      const panel = destino?.closest<HTMLElement>("[data-pestana]");
      if (!destino || !panel || !contenedor.current.contains(panel)) return;
      setActivo(panel.dataset.pestana!);
      requestAnimationFrame(() => destino.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
    irAlAncla();
    window.addEventListener("hashchange", irAlAncla);
    return () => window.removeEventListener("hashchange", irAlAncla);
  }, []);

  return (
    <div ref={contenedor} className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start lg:gap-4">
      <div
        role="tablist"
        aria-label={etiqueta}
        aria-orientation="vertical"
        className="sticky top-14 z-10 mb-4 flex gap-0 overflow-x-auto rounded-md border border-stone-200 bg-white print:hidden lg:mb-0 lg:flex-col lg:overflow-visible"
      >
        {visibles.map((g) => {
          const sel = g.id === activo;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => setActivo(g.id)}
              className={`flex flex-none items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-left text-sm transition-colors lg:w-full lg:border-b lg:border-l-[3px] lg:border-b-stone-100 lg:last:border-b-0 ${
                sel
                  ? "border-b-cdmb-600 bg-white font-semibold text-stone-900 lg:border-l-cdmb-600 lg:border-b-stone-100"
                  : "border-transparent text-stone-600 hover:bg-stone-50 hover:text-stone-900 lg:bg-stone-50/60"
              }`}
            >
              <span className={sel ? "text-cdmb-600" : "text-stone-400"}>{g.icono}</span>
              <span className="min-w-0 flex-1 truncate">{g.label}</span>
              {g.contador !== undefined && (
                <span className="rounded-sm bg-sky-100 px-1.5 text-[11px] font-semibold tabular-nums text-sky-800">{g.contador}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="min-w-0">
        {visibles.map((g) => (
          <div
            key={g.id}
            role="tabpanel"
            aria-label={g.label}
            data-pestana={g.id}
            className={`space-y-4 ${g.id === activo ? "" : "hidden print:block"}`}
          >
            {g.contenido}
          </div>
        ))}
      </div>
    </div>
  );
}
