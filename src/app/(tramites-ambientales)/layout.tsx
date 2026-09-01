import type { ReactNode } from "react";
import { Leaf } from "lucide-react";
import { TramitesTabs } from "@/components/TramitesTabs";

/**
 * Sección "Trámites ambientales": el panel, el catálogo de trámites, los
 * expedientes y los solicitantes — la operación diaria de la CDMB. Es un route
 * group (no cambia las URLs: `/`, `/tramites`, `/expedientes`, `/solicitantes`),
 * solo agrega la cabecera y las pestañas comunes.
 */
export default function TramitesAmbientalesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
          <Leaf className="h-4 w-4" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold text-stone-900">Trámites ambientales</h1>
      </div>

      <TramitesTabs />

      {children}
    </div>
  );
}
