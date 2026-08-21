import { getConfiguracionSitio } from "@/lib/config-sitio";

/** Franja institucional azul GOV.CO — solo aparece si ya se subió el sello desde /admin/apariencia. */
export async function FranjaGovCo() {
  const config = await getConfiguracionSitio();
  if (!config.logoGovcoUrl) return null;

  return (
    <div className="w-full bg-[#3366CC] px-4 py-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={config.logoGovcoUrl} alt="GOV.CO" className="h-5 w-auto" />
    </div>
  );
}
