import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederContratacion, puedeAdministrarGecon } from "@/lib/permisos";
import { contarPendientesBuzonContratacion } from "@/lib/solicitudes-firma";
import { PanelGeconNav } from "@/components/PanelGeconNav";

export default async function PanelGeconLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");
  const pendientes = await contarPendientesBuzonContratacion(session.userId);

  return (
    <div className="space-y-4">
      <PanelGeconNav gestion={puedeAdministrarGecon(permisos)} pendientes={pendientes.listos} />
      {children}
    </div>
  );
}
