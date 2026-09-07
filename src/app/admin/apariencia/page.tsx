import { redirect } from "next/navigation";
import { verificarSesion as getSession } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { SectionHelp } from "@/components/Field";
import { SubirLogoForm } from "@/components/SubirLogoForm";

export default async function AparienciaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") redirect("/");

  const config = await getConfiguracionSitio();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Apariencia</h1>
        <p className="text-sm text-stone-500">
          Logo de la CDMB y sellos institucionales que se muestran en el encabezado y el pie de página.
        </p>
      </div>

      <SectionHelp>
        Franja institucional arriba (sello GOV.CO) y en el pie de página (sellos de Colombia y GOV.CO), igual
        que Negocios Verdes. Cada una aparece solo si tiene una imagen cargada.
      </SectionHelp>

      <div className="space-y-4">
        <SubirLogoForm
          campo="logo"
          urlActual={config.logoUrl}
          etiqueta="Logo de la CDMB"
          ayuda="Aparece en el encabezado (junto a 'Trámites CDMB') y en el pie de página. Fondo transparente recomendado (PNG o SVG)."
        />
        <SubirLogoForm
          campo="govco"
          urlActual={config.logoGovcoUrl}
          etiqueta="Sello GOV.CO"
          ayuda="Aparece en la franja azul superior y también en la del pie de página."
        />
        <SubirLogoForm
          campo="colombia"
          urlActual={config.logoColombiaUrl}
          etiqueta="Sello de Colombia"
          ayuda="Aparece en la franja azul del pie de página."
        />
        <SubirLogoForm
          campo="potencia"
          urlActual={config.logoPotenciaUrl}
          etiqueta={'Sello "Colombia Potencia de la Vida"'}
          ayuda="Aparece en la franja azul del pie de página, junto al sello de Colombia."
        />
      </div>
    </div>
  );
}
