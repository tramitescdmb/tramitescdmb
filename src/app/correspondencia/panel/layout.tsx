import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeAdministrarArchivo } from "@/lib/permisos";
import { SectionHelp } from "@/components/Field";
import { PanelCicloNav } from "@/components/PanelCicloNav";

/**
 * Tablero del SGDEA. El módulo se recorre como un ciclo de cuatro vistas —
 * mi trabajo → correspondencia → archivo → sistema — cada una en su propia
 * ruta. La navegación circular es común a todas; el contenido lo pone cada
 * vista.
 */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");
  const esAdmin = puedeAdministrarArchivo(permisos);

  return (
    <div className="space-y-6">
      <SectionHelp>
        Tablero del SGDEA. Cada anillo abre una vista: primero <strong>su trabajo pendiente</strong>, luego el
        panorama de la correspondencia y del archivo de la Corporación
        {esAdmin ? " y, al final, las incidencias del sistema" : ""}.
      </SectionHelp>
      <PanelCicloNav esAdmin={esAdmin} />
      {children}
    </div>
  );
}
