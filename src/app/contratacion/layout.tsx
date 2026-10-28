import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Briefcase, ShieldCheck, HelpCircle } from "lucide-react";
import { ContratacionTabs } from "@/components/ContratacionTabs";
import { MigaGecon } from "@/components/MigaGecon";
import { AccesosRapidosExpediente } from "@/components/AccesosRapidosExpediente";
import { accesosExpediente } from "@/lib/accesos-expediente";
import { verificarSesion as getSession } from "@/lib/permisos";
import { contarPendientesBuzonContratacion, contarRechazosPorAtender } from "@/lib/solicitudes-firma";
import { contarInformesPorRadicarPropios } from "@/lib/contratacion-panel";
import { obtenerPermisosUsuario, puedeAccederContratacion, puedeGestionarContratistas, puedeVerRegistroContratistas, puedeAdministrarContratacion, puedeAdministrarGecon, puedeAdministrarCatalogoContratacion, puedeCrearExpedienteContractual, puedeVerTableroContratos } from "@/lib/permisos";

export default async function ContratacionLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");
  const accesos = accesosExpediente(permisos, "GECON");
  const [pendientesFirma, rechazosFirma, informesPorRadicar] = await Promise.all([
    contarPendientesBuzonContratacion(session.userId),
    contarRechazosPorAtender(session.userId, false, "documentoContrato"),
    contarInformesPorRadicarPropios(permisos),
  ]);

  return (
    <div className="space-y-4">
      <div className="encabezado-modulo">
        <div className="flex flex-wrap items-center gap-2">
          <Briefcase className="h-6 w-6 flex-none text-cdmb-600" aria-hidden />
          <h1 className="text-xl font-semibold text-stone-900">GECON</h1>
          <span className="flex items-center gap-1 rounded-sm bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Manejador de expedientes digitales
          </span>
          <div className="ml-auto">
            <AccesosRapidosExpediente {...accesos} />
          </div>
          <Link
            href="/contratacion/ayuda"
            aria-label="Ayuda — guía de referencia de GECON"
            className="flex flex-none items-center gap-1.5 rounded-md border border-cdmb-200 bg-white px-2.5 py-1 text-xs font-semibold text-cdmb-700 shadow-sm transition hover:border-cdmb-400 hover:bg-cdmb-50"
          >
            <HelpCircle className="h-3.5 w-3.5" aria-hidden />
            Ayuda
          </Link>
        </div>
      </div>

      <div className="encabezado-modulo">
        <ContratacionTabs
          pendientesFirma={pendientesFirma}
          rechazosFirma={rechazosFirma}
          informesPorRadicar={informesPorRadicar}
          permitido={{
            administrar: puedeGestionarContratistas(permisos),
            crearExpediente: puedeCrearExpedienteContractual(permisos),
            catalogo: puedeAdministrarCatalogoContratacion(permisos),
            verContratistas: puedeVerRegistroContratistas(permisos),
            soloAdministrador: puedeAdministrarContratacion(permisos),
            gestion: puedeAdministrarGecon(permisos),
            tableroContratos: puedeVerTableroContratos(permisos),
            administradorSistema: permisos.esAdmin,
          }}
        />
      </div>

      <div className="encabezado-modulo">
        <MigaGecon />
      </div>

      <div>{children}</div>
    </div>
  );
}
