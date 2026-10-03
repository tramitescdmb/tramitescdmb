"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type GrupoPestana = { id: string; label: string; icono?: ReactNode; contador?: number; oculta?: boolean; contenido: ReactNode };

export function PestanasDetalle({ grupos, inicial }: { grupos: GrupoPestana[]; inicial?: string }) {
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
    <div ref={contenedor} className="space-y-4">
      <div
        role="tablist"
        aria-label="Secciones de la comunicación"
        className="sticky top-0 z-10 flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-soft print:hidden"
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
              className={`inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                sel ? "bg-menu-500 text-stone-900" : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
              }`}
            >
              {g.icono}
              {g.label}
              {g.contador !== undefined && (
                <span className={`rounded-full px-1.5 text-[11px] ${sel ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500"}`}>{g.contador}</span>
              )}
            </button>
          );
        })}
      </div>

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
  );
}
