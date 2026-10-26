import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { FileBadge } from "lucide-react";
import { TramitesTabs } from "@/components/TramitesTabs";
import { MigaTramites } from "@/components/MigaTramites";
import { SincronizadorVisitas } from "@/components/planeador/SincronizadorVisitas";
import { contarPendientesBuzonTramite, contarRechazosPorAtender } from "@/lib/solicitudes-firma";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { SIN_PENDIENTES_FIRMA } from "@/lib/calidad-firma";
import { verificarSesion as getSession } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { contarAlertasVisitasPropias } from "@/lib/pendientes-visitas";
import { contarNoLeidas } from "@/lib/notificaciones";
import { conceptosDevueltosA, conceptosPorRevisar } from "@/lib/revision-concepto";
import { obtenerPermisosUsuario, puedeAccederSolicitantes, puedeAccederFirmasTramite, puedeEditarFormatosVisita, puedePlanearVisitas } from "@/lib/permisos";

export default async function TramitesAmbientalesLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const [permisos, config] = await Promise.all([obtenerPermisosUsuario(session.userId), getConfiguracionSitio()]);
  if (!permisos.modulos.has("TRAMITES")) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-soft">
        <FileBadge className="mx-auto h-6 w-6 text-stone-300" aria-hidden />
        <h1 className="mt-2 text-base font-semibold text-stone-900">Trámites ambientales 2.0 no está disponible</h1>
        <p className="mt-1 text-sm text-stone-500">
          {config.tramitesVisibleFuncionarios
            ? "Su usuario no tiene acceso a este módulo. Si lo necesita, solicítelo a un administrador."
            : "El administrador del sistema deshabilitó temporalmente este módulo. Seleccione otro módulo en el menú lateral."}
        </p>
      </div>
    );
  }
  const mostrarSolicitantes = puedeAccederSolicitantes(permisos);
  const mostrarFirmas = puedeAccederFirmasTramite(permisos);
  const [pendientesFirma, alertasPlaneador, avisosBuzon, rechazosFirma, porRevisar, devueltos] = await Promise.all([
    mostrarFirmas ? contarPendientesBuzonTramite(session.userId) : Promise.resolve(SIN_PENDIENTES_FIRMA),
    contarAlertasVisitasPropias(session.userId),
    contarNoLeidas(session.userId),
    mostrarFirmas ? contarRechazosPorAtender(session.userId, false, "documentoExpediente") : Promise.resolve(0),
    puedePlanearVisitas(permisos) ? conceptosPorRevisar(permisos).then((l) => l.length) : Promise.resolve(0),
    conceptosDevueltosA(session.userId).then((l) => l.length),
  ]);

  return (
    <div className="space-y-4">
      <div className="encabezado-modulo">
        <div className="flex flex-wrap items-center gap-2">
          <FileBadge className="h-6 w-6 flex-none text-cdmb-600" aria-hidden />
          <h1 className="text-xl font-semibold text-stone-900">Trámites ambientales 2.0</h1>
          <Link
            href="/tramites-ambientales/ayuda"
            aria-label="Ayuda — guía de referencia de Trámites ambientales 2.0"
            className="ml-auto flex flex-none items-center gap-1.5 rounded-md border border-cdmb-200 bg-white px-2.5 py-1 text-xs font-semibold text-cdmb-700 shadow-sm transition hover:border-cdmb-400 hover:bg-cdmb-50"
          >
            <HelpCircle className="h-3.5 w-3.5" aria-hidden />
            Ayuda
          </Link>
        </div>
      </div>

      <div className="encabezado-modulo">
        <TramitesTabs mostrarSolicitantes={mostrarSolicitantes} mostrarFirmas={mostrarFirmas} pendientesFirma={pendientesFirma} alertasPlaneador={alertasPlaneador} avisosBuzon={avisosBuzon} rechazosFirma={rechazosFirma} conceptos={porRevisar + devueltos} esAdmin={session.rol === "ADMIN"} editaFormatos={puedeEditarFormatosVisita(permisos)} />
      </div>

      <div className="encabezado-modulo">
        <MigaTramites />
      </div>

      <SincronizadorVisitas />

      {children}
    </div>
  );
}
