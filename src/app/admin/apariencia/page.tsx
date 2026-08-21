import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
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
        Mismo esquema que usa Negocios Verdes: una franja azul institucional arriba (con el sello GOV.CO)
        y otra en el pie de página (con los sellos de Colombia y GOV.CO). Cada franja solo aparece si ya
        subiste la imagen correspondiente — mientras esté vacía, no se muestra nada.
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
