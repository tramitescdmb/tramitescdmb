import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Leaf } from "lucide-react";
import { TramitesTabs } from "@/components/TramitesTabs";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSolicitantes, puedeAccederFirmasTramite } from "@/lib/permisos";

export default async function TramitesAmbientalesLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  const mostrarSolicitantes = puedeAccederSolicitantes(permisos);
  const mostrarFirmas = puedeAccederFirmasTramite(permisos);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
          <Leaf className="h-4 w-4" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold text-stone-900">Trámites ambientales 2.0</h1>
      </div>

      <TramitesTabs mostrarSolicitantes={mostrarSolicitantes} mostrarFirmas={mostrarFirmas} />

      {children}
    </div>
  );
}
