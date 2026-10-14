import { redirect } from "next/navigation";
import { NuevoSolicitanteForm } from "@/components/NuevoSolicitanteForm";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSolicitantes } from "@/lib/permisos";
import { UserPlus } from "lucide-react";
import { CabeceraTablero, EnlaceTablero } from "@/components/tablero";

export default async function NuevoSolicitantePage() {
  const session = await getSession();
  if (session) {
    const permisos = await obtenerPermisosUsuario(session.userId);
    if (!puedeAccederSolicitantes(permisos)) redirect("/");
  }

  return (
    <div className="space-y-4">
      <CabeceraTablero
        icon={UserPlus}
        titulo="Nuevo solicitante"
        descripcion="Registra un NIT o cédula antes de su primer trámite; al radicar, la búsqueda por identificación completa estos datos."
        acciones={<EnlaceTablero href="/solicitantes">Volver a solicitantes</EnlaceTablero>}
      />

      <NuevoSolicitanteForm />
    </div>
  );
}
