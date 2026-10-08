import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { TituloSeccion } from "@/components/sgdea/ui";
import { TerceroForm } from "@/components/TerceroForm";

export default async function NuevoTerceroPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeRadicar(permisos)) {
    return <AccesoRestringido titulo="Nuevo tercero" quien="ventanilla o administrador de archivo" volverHref="/correspondencia/terceros" volverLabel="Ver terceros" />;
  }
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <TituloSeccion icon={UserPlus}>Nuevo tercero</TituloSeccion>
      <TerceroForm />
    </section>
  );
}
