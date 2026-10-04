import Link from "next/link";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { MenuPublico } from "@/components/MenuPublico";

export async function PublicShellHeader() {
  const config = await getConfiguracionSitio();

  return (
    <header className="border-b-[3px] border-menu-500 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link prefetch={false} href="/pqrsd" className="flex min-w-0 items-center gap-2.5">
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoUrl} alt="CDMB" className="h-9 w-auto flex-none" />
          ) : (
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-cdmb-600 text-sm font-bold text-white">
              C
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-stone-900">CDMB</span>
            <span className="block truncate text-[11px] text-stone-500">Ventanilla de atención al ciudadano</span>
          </span>
        </Link>
        <MenuPublico />
      </div>
    </header>
  );
}
