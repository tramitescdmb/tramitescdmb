import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Link2, Lock } from "lucide-react";
import { VitalTabs } from "@/components/VitalTabs";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";

/**
 * Sección VITAL: solicitudes traídas de la Ventanilla Integral de Trámites
 * Ambientales en Línea (MinAmbiente) por X-Road. Solo lectura. El acceso se
 * configura por pestaña desde /usuarios/[id] (denegado por defecto, como los
 * trámites de "Trámites ambientales 2.0") — el ADMIN siempre entra a todo.
 */
export default async function VitalLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  const permitido = {
    base: puedeAccederSeccion(permisos, "VITAL_BASE"),
    dashboard: puedeAccederSeccion(permisos, "VITAL_DASHBOARD"),
  };
  if (!permitido.base && !permitido.dashboard) redirect("/");

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
            <Link2 className="h-4 w-4" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold text-stone-900">VITAL</h1>
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500 hover:bg-stone-200 [&::-webkit-details-marker]:hidden">
              <Lock className="h-3 w-3" aria-hidden />
              Solo lectura
            </summary>
            <p className="absolute left-0 top-full z-10 mt-1 w-72 rounded-md border border-stone-200 bg-white p-3 text-xs text-stone-600 shadow-lg">
              Las solicitudes se traen de VITAL por el bus X-Road de la CDMB. No se reporta ni modifica nada
              de vuelta a VITAL desde esta aplicación.
            </p>
          </details>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          Solicitudes radicadas por el ciudadano en la Ventanilla Integral de Trámites Ambientales en Línea
          (VITAL) de MinAmbiente.
        </p>
      </div>

      <VitalTabs permitido={permitido} />

      {children}
    </div>
  );
}
