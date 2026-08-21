import { getConfiguracionSitio } from "@/lib/config-sitio";

/**
 * Pie de página institucional — mismo patrón que Negocios Verdes: cuerpo
 * blanco (logo CDMB + nombre) y, solo si ya se subieron los sellos desde
 * /admin/apariencia, la franja azul GOV.CO con los sellos oficiales. Si no
 * hay sellos, esa franja no aparece (nunca una franja azul vacía).
 */
export async function Footer() {
  const config = await getConfiguracionSitio();
  const sellos = [
    { url: config.logoColombiaUrl, alt: "Colombia" },
    { url: config.logoPotenciaUrl, alt: "Colombia Potencia de la Vida" },
    { url: config.logoGovcoUrl, alt: "GOV.CO" },
  ].filter((s) => s.url);

  return (
    <footer className="mt-12 border-t border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoUrl} alt="CDMB" className="h-8 w-auto" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cdmb-600 text-sm font-bold text-white">
              C
            </span>
          )}
          <div>
            <p className="text-sm font-medium text-stone-800">
              CDMB — Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga
            </p>
            <p className="text-xs text-stone-500">Sistema interno de gestión de trámites ambientales</p>
          </div>
        </div>
        <p className="text-xs text-stone-400">© {new Date().getFullYear()} CDMB. Todos los derechos reservados.</p>
      </div>

      {sellos.length > 0 && (
        <div className="w-full bg-[#3366CC] px-4 py-4">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6">
            {sellos.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s.alt} src={s.url!} alt={s.alt} className="h-7 w-auto" />
            ))}
          </div>
        </div>
      )}
    </footer>
  );
}
