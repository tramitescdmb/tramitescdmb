import type { ReactNode } from "react";

export function EncabezadoPaso({ numero, icono, titulo, descripcion }: { numero: number; icono: ReactNode; titulo: string; descripcion?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-cdmb-600 text-sm font-semibold text-white" aria-hidden>
        {numero}
      </span>
      <div className="min-w-0">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
          <span className="text-cdmb-600">{icono}</span>
          {titulo}
        </h2>
        {descripcion && <p className="mt-0.5 text-xs text-stone-500">{descripcion}</p>}
      </div>
    </div>
  );
}
