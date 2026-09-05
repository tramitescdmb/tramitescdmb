import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Mail, ShieldCheck } from "lucide-react";
import { CorrespondenciaTabs } from "@/components/CorrespondenciaTabs";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeRadicar, puedeAdministrarArchivo } from "@/lib/permisos";

/**
 * Módulo de Correspondencia y Gestión Documental (SGDEA). Denegado por defecto:
 * requiere un rol de correspondencia asignado (o ser ADMIN). Ver src/lib/permisos.ts.
 */
export default async function CorrespondenciaLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");

  const permitido = {
    bandeja: true,
    radicar: puedeRadicar(permisos),
    admin: puedeAdministrarArchivo(permisos),
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
            <Mail className="h-4 w-4" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold text-stone-900">Correspondencia</h1>
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Radicado inalterable
          </span>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          Ventanilla única de radicación y gestión documental electrónica (SGDEA), conforme al Acuerdo 060/2001 del AGN.
          Toda acción queda en una bitácora de auditoría inalterable.
        </p>
      </div>

      <CorrespondenciaTabs permitido={permitido} />

      {children}
    </div>
  );
}
