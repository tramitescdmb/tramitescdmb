import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederContratacion, puedeAdministrarSigec } from "@/lib/permisos";
import { contarPendientesBuzonContratacion } from "@/lib/solicitudes-firma";
import { PanelSigecNav } from "@/components/PanelSigecNav";

/** Tablero de SIGEC: cuatro vistas unidas por un ciclo de anillos (ver `CicloVistasNav`). */
export default async function PanelSigecLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");
  const pendientes = await contarPendientesBuzonContratacion(session.userId);

  return (
    <div className="space-y-4">
      <PanelSigecNav gestion={puedeAdministrarSigec(permisos)} pendientes={pendientes.listos} />
      {children}
    </div>
  );
}
