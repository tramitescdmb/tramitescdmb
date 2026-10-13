import { redirect } from "next/navigation";
import { Scale } from "lucide-react";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAdministrarGecon, puedeGestionarContratistas } from "@/lib/permisos";
import { listarTopesCuantia } from "@/lib/contratacion";
import { TituloSeccion } from "@/components/sgdea/ui";
import { SectionHelp } from "@/components/Field";
import { TopesCuantiaAdmin } from "@/components/TopesCuantiaAdmin";

export default async function TopesCuantiaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarGecon(permisos)) {
    return <AccesoRestringido titulo="Topes de cuantía" volverHref="/contratacion/panel" volverLabel="Volver al panel" />;
  }
  const topes = await listarTopesCuantia();

  return (
    <section className="space-y-4">
      <TituloSeccion icon={Scale}>Topes de cuantía por vigencia</TituloSeccion>
      <SectionHelp>
        La Oficina de Contratación calcula cada enero la menor cuantía según el presupuesto anual de la CDMB expresado en SMMLV y la
        comunica por circular (Ley 1150 de 2007, art. 2, num. 2, lit. b; Manual A-BS-MA01, num. 6.2.2.2). La mínima cuantía es el 10 %
        de la menor. Con estos topes se valida el valor de cada contrato frente a su modalidad, según el año de suscripción.
      </SectionHelp>
      <TopesCuantiaAdmin topes={topes} puedeEditar={puedeGestionarContratistas(permisos)} />
    </section>
  );
}
