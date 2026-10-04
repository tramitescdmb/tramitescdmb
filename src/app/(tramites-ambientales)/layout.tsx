import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Leaf } from "lucide-react";
import { TramitesTabs } from "@/components/TramitesTabs";
import { MigaTramites } from "@/components/MigaTramites";
import { contarPendientesBuzonTramite } from "@/lib/solicitudes-firma";
import { SIN_PENDIENTES_FIRMA } from "@/lib/calidad-firma";
import { verificarSesion as getSession } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { obtenerPermisosUsuario, puedeAccederSolicitantes, puedeAccederFirmasTramite } from "@/lib/permisos";

export default async function TramitesAmbientalesLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const [permisos, config] = await Promise.all([obtenerPermisosUsuario(session.userId), getConfiguracionSitio()]);
  if (!permisos.esAdmin && !config.tramitesVisibleFuncionarios) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-soft">
        <Leaf className="mx-auto h-6 w-6 text-stone-300" aria-hidden />
        <h1 className="mt-2 text-base font-semibold text-stone-900">Trámites ambientales 2.0 no está disponible</h1>
        <p className="mt-1 text-sm text-stone-500">
          El administrador del sistema deshabilitó temporalmente este módulo. Seleccione otro módulo en el menú lateral.
        </p>
      </div>
    );
  }
  const mostrarSolicitantes = puedeAccederSolicitantes(permisos);
  const mostrarFirmas = puedeAccederFirmasTramite(permisos);
  const pendientesFirma = mostrarFirmas ? await contarPendientesBuzonTramite(session.userId) : SIN_PENDIENTES_FIRMA;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
            <Leaf className="h-4 w-4" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold text-stone-900">Trámites ambientales 2.0</h1>
        </div>
        <p className="mt-1 text-sm text-stone-500">Radicación, gestión por pasos, firma y seguimiento georreferenciado de los trámites ambientales de la CDMB.</p>
      </div>

      <TramitesTabs mostrarSolicitantes={mostrarSolicitantes} mostrarFirmas={mostrarFirmas} pendientesFirma={pendientesFirma} />

      <MigaTramites />

      {children}
    </div>
  );
}
