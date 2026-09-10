import Link from "next/link";
import { getConfiguracionSitio } from "@/lib/config-sitio";

/**
 * Encabezado de la ventanilla pública (PQRSD) — sin la navegación interna de la
 * aplicación. Solo la marca institucional y los dos accesos que un ciudadano
 * necesita: radicar una solicitud y consultar su estado.
 */
export async function PublicShellHeader() {
  const config = await getConfiguracionSitio();

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/pqrsd" className="flex min-w-0 items-center gap-2.5">
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoUrl} alt="CDMB" className="h-9 w-auto flex-none" />
          ) : (
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-cdmb-600 text-sm font-bold text-white">
              C
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-cdmb-800">CDMB</span>
            <span className="block truncate text-[11px] text-stone-500">Ventanilla de atención al ciudadano</span>
          </span>
        </Link>
        <nav className="flex flex-none items-center gap-1 text-sm">
          <Link href="/pqrsd" className="rounded-md px-3 py-1.5 font-medium text-stone-600 hover:bg-stone-50 hover:text-cdmb-800">
            Radicar PQRSD
          </Link>
          <Link href="/pqrsd/consultar" className="rounded-md px-3 py-1.5 font-medium text-stone-600 hover:bg-stone-50 hover:text-cdmb-800">
            Consultar estado
          </Link>
        </nav>
      </div>
    </header>
  );
}
