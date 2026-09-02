import type { ReactNode } from "react";
import { Archive, Lock } from "lucide-react";
import { HistoricoTabs } from "@/components/HistoricoTabs";

/**
 * Sección "SINCA 1.0 · Consulta histórica". Es un espejo de solo lectura de las
 * solicitudes del sistema anterior. Ninguna pantalla de aquí crea, edita ni
 * elimina datos. Abierta a cualquier funcionario — el Rol de acceso (sección
 * Roles) solo restringe trámites dentro de "Trámites ambientales 2.0".
 */
export default function HistoricoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
            <Archive className="h-4 w-4" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold text-stone-900">SINCA 1.0 · Consulta histórica</h1>
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500 hover:bg-stone-200 [&::-webkit-details-marker]:hidden">
              <Lock className="h-3 w-3" aria-hidden />
              Solo consulta
            </summary>
            <p className="absolute left-0 top-full z-10 mt-1 w-72 rounded-md border border-stone-200 bg-white p-3 text-xs text-stone-600 shadow-lg">
              Información histórica: estos registros no se pueden crear, modificar ni eliminar desde esta
              aplicación; provienen del sistema SINCA 1.0.
            </p>
          </details>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          Solicitudes registradas en el sistema anterior de la CDMB (SINCA 1.0).
        </p>
      </div>

      <HistoricoTabs />

      {children}
    </div>
  );
}
