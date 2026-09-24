import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Briefcase, ShieldCheck, HelpCircle } from "lucide-react";
import { ContratacionTabs } from "@/components/ContratacionTabs";
import { MigaSigec } from "@/components/MigaSigec";
import { verificarSesion as getSession } from "@/lib/permisos";
import { contarPendientesBuzonContratacion } from "@/lib/solicitudes-firma";
import { obtenerPermisosUsuario, puedeAccederContratacion, puedeGestionarContratistas, puedeVerRegistroContratistas, puedeAdministrarContratacion, puedeAdministrarSigec } from "@/lib/permisos";

export default async function ContratacionLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");
  const pendientesFirma = await contarPendientesBuzonContratacion(session.userId);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
            <Briefcase className="h-4 w-4" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold text-stone-900">SIGEC</h1>
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Manejador de expedientes digitales
          </span>
          <Link
            href="/contratacion/ayuda"
            aria-label="Ayuda — guía de referencia de SIGEC"
            className="ml-auto flex flex-none items-center gap-1.5 rounded-md border border-cdmb-200 bg-white px-2.5 py-1 text-xs font-semibold text-cdmb-700 shadow-sm transition hover:border-cdmb-400 hover:bg-cdmb-50"
          >
            <HelpCircle className="h-3.5 w-3.5" aria-hidden />
            Ayuda
          </Link>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          Sistema Integrado de Gestión de Expedientes de Contratación — expediente, flujo documental, firma
          selectiva y control de acceso por rol. No reemplaza SECOP II ni valida cuantías o reglas jurídicas de
          cada modalidad de selección (Manual de Contratación A-BS-MA01).
        </p>
      </div>

      <ContratacionTabs
        pendientesFirma={pendientesFirma}
        permitido={{
          administrar: puedeGestionarContratistas(permisos),
          verContratistas: puedeVerRegistroContratistas(permisos),
          soloAdministrador: puedeAdministrarContratacion(permisos),
          gestion: puedeAdministrarSigec(permisos),
          administradorSistema: permisos.esAdmin,
        }}
      />

      <MigaSigec />

      <div>{children}</div>
    </div>
  );
}
