import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Leaf } from "lucide-react";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { accedePanelNV } from "@/lib/negocios-verdes-permisos";
import { configuracionPublicaNV } from "@/lib/negocios-verdes-data";

export const metadata: Metadata = {
  title: { default: "Negocios Verdes — CDMB", template: "%s — Negocios Verdes CDMB" },
  description: "Directorio de negocios verdes de los 13 municipios de la jurisdicción de la CDMB.",
};

/**
 * Sitio público de Negocios Verdes. Sin cuentas: la ciudadanía solo consulta. Mientras la casilla
 * «Negocios Verdes — Sitio público» de /admin/modulos esté apagada, se muestra «Sitio en preparación»,
 * salvo a quien tiene acceso al panel interno, que lo ve en vista previa.
 */
export default async function NegociosVerdesPublicoLayout({ children }: { children: ReactNode }) {
  const config = await getConfiguracionSitio();
  const abierto = config.negociosVerdesSitioPublico === true;
  let vistaPrevia = false;
  if (!abierto) {
    const session = await verificarSesion();
    vistaPrevia = Boolean(session && accedePanelNV(await obtenerPermisosUsuario(session.userId)));
  }
  const nv = await configuracionPublicaNV().catch(() => ({ logoUrl: null, banners: [] }));

  return (
    <div className="flex min-h-full flex-col bg-stone-50">
      <header className="border-b-[3px] border-emerald-600 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link prefetch={false} href="/negocios-verdes" className="flex min-w-0 items-center gap-2.5">
            {nv.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={nv.logoUrl} alt="Negocios Verdes CDMB" className="h-10 w-auto flex-none" />
            ) : (
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-emerald-600 text-white">
                <Leaf className="h-5 w-5" aria-hidden />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold text-stone-900">Negocios Verdes</span>
              <span className="block truncate text-xs text-stone-500">CDMB — Meseta de Bucaramanga</span>
            </span>
          </Link>
          <nav aria-label="Negocios Verdes" className="flex items-center gap-1 text-sm">
            <Link prefetch={false} href="/negocios-verdes" className="rounded-md px-3 py-1.5 font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-800">
              Inicio
            </Link>
            <Link prefetch={false} href="/negocios-verdes#buscar" className="rounded-md px-3 py-1.5 font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-800">
              Buscar negocios
            </Link>
          </nav>
        </div>
      </header>

      {vistaPrevia && (
        <p className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-800" role="status">
          Vista previa: el sitio público está apagado en Administración → Módulos. La ciudadanía ve «Sitio en preparación».
        </p>
      )}

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
        {abierto || vistaPrevia ? (
          children
        ) : (
          <div className="mx-auto max-w-xl rounded-xl border border-stone-200 bg-white p-8 text-center">
            <Leaf className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
            <h1 className="mt-3 text-xl font-semibold text-stone-900">Sitio en preparación</h1>
            <p className="mt-2 text-sm text-stone-600">El directorio de Negocios Verdes de la CDMB estará disponible aquí muy pronto.</p>
          </div>
        )}
      </div>
    </div>
  );
}
