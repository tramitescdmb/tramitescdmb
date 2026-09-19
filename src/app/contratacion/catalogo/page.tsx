import { redirect } from "next/navigation";
import { ListChecks } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarContratacion } from "@/lib/permisos";
import { listarCatalogoRequisitos } from "@/lib/contratacion";
import { TituloSeccion } from "@/components/sgdea/ui";
import { SectionHelp } from "@/components/Field";
import { CatalogoRequisitosAdmin } from "@/components/CatalogoRequisitosAdmin";

/** Catálogo administrable de requisitos documentales por etapa — antes solo se cargaba por script
 * (`data/contratacion/requisitos.json`). Reservado al Administrador de Contratación. */
export default async function CatalogoRequisitosPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarContratacion(permisos)) redirect("/contratacion");

  const requisitos = await listarCatalogoRequisitos();

  return (
    <section className="space-y-4">
      <TituloSeccion icon={ListChecks}>Catálogo de requisitos documentales</TituloSeccion>
      <SectionHelp>
        Define qué documentos se piden en cada etapa (y, opcionalmente, para cada modalidad de
        selección) — orden, si es obligatorio y el código de formato del Manual A-BS-MA01. Los
        cambios se reflejan de inmediato en el checklist de todos los expedientes.
      </SectionHelp>
      <CatalogoRequisitosAdmin requisitos={requisitos} />
    </section>
  );
}
