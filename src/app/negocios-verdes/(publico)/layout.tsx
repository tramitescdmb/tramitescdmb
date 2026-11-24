import type { ReactNode } from "react";
import type { Metadata } from "next";
import { accesoSitioNV } from "@/lib/negocios-verdes-acceso";
import { configuracionPublicaNV } from "@/lib/negocios-verdes-data";
import { EncabezadoNV } from "@/components/negocios-verdes/sitio/EncabezadoNV";
import { PieNV } from "@/components/negocios-verdes/sitio/PieNV";
import { LOGO_CDMB_NV } from "@/lib/negocios-verdes-sitio";

export const metadata: Metadata = {
  title: { default: "Negocios Verdes CDMB", template: "%s — Negocios Verdes CDMB" },
  description: "Directorio de negocios verdes de los 13 municipios de la jurisdicción de la CDMB.",
};


/**
 * Sitio público de Negocios Verdes, con el aspecto de su plataforma anterior (Work Sans, fondo crema,
 * menú con la opción activa en verde). Sin cuentas: la ciudadanía solo consulta. Mientras la casilla
 * «Negocios Verdes — Sitio público» de /admin/modulos esté apagada, se muestra «Sitio en preparación»,
 * salvo a quien tiene acceso al panel interno, que lo ve en vista previa.
 */
export default async function NegociosVerdesPublicoLayout({ children }: { children: ReactNode }) {
  const { abierto, vistaPrevia } = await accesoSitioNV();
  const nv = await configuracionPublicaNV().catch(() => ({ logoUrl: null, logosPie: [], banners: [] }));
  const logo = nv.logoUrl ?? LOGO_CDMB_NV;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-nv-fondo font-nv text-nv-texto">
      <EncabezadoNV logoUrl={logo} />
      {vistaPrevia && (
        <p className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-800" role="status">
          Vista previa: el sitio público está apagado en Administración → Módulos. La ciudadanía ve «Sitio en preparación».
        </p>
      )}
      <div className="flex-1">
        {abierto || vistaPrevia ? (
          children
        ) : (
          <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="CDMB" className="h-14 w-auto" />
            <h1 className="mt-4 text-2xl font-semibold">Sitio en preparación</h1>
            <p className="mt-2 text-sm text-nv-texto2">El directorio de Negocios Verdes de la CDMB estará disponible aquí muy pronto.</p>
          </div>
        )}
      </div>
      <PieNV logoUrl={logo} sellos={nv.logosPie} />
    </div>
  );
}
