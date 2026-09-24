import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Archive, Lock } from "lucide-react";
import { HistoricoTabs } from "@/components/HistoricoTabs";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";

export default async function HistoricoLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  const permitido = {
    base: puedeAccederSeccion(permisos, "SINCA_BASE"),
    dashboard: puedeAccederSeccion(permisos, "SINCA_DASHBOARD"),
    mineria: puedeAccederSeccion(permisos, "SINCA_MINERIA"),
  };
  if (!permitido.base && !permitido.dashboard && !permitido.mineria) redirect("/");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-graphite-100 bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-cdmb-50 text-cdmb-700">
            <Archive className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-graphite-900">SINCA 1.0 · Consulta histórica</h1>
              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full bg-graphite-100 px-2 py-0.5 text-xs font-medium text-graphite-500 hover:bg-graphite-200 [&::-webkit-details-marker]:hidden">
                  <Lock className="h-3 w-3" aria-hidden />
                  Solo consulta
                </summary>
                <p className="absolute left-0 top-full z-10 mt-1 w-72 rounded-xl border border-graphite-200 bg-white p-3 text-xs text-graphite-600 shadow-soft-lg">
                  Información histórica: estos registros no se pueden crear, modificar ni eliminar desde esta
                  aplicación; provienen del sistema SINCA 1.0.
                </p>
              </details>
            </div>
            <p className="mt-0.5 text-sm text-graphite-500">
              Solicitudes registradas en el sistema anterior de la CDMB (SINCA 1.0).
            </p>
          </div>
        </div>
      </div>

      <HistoricoTabs permitido={permitido} />

      {children}
    </div>
  );
}
