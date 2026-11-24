import type { Metadata } from "next";
import { accesoSitioNV } from "@/lib/negocios-verdes-acceso";
import { datosGeovisorNV } from "@/lib/negocios-verdes-geovisor-data";
import { GeovisorNV } from "@/components/negocios-verdes/GeovisorNV";

export const metadata: Metadata = { title: "Geovisor — Negocios Verdes CDMB", robots: { index: false } };

/**
 * Geovisor para incrustar en otras páginas de la CDMB (iframe): sin encabezado ni pie, los enlaces
 * de las fichas abren en pestaña nueva. Quién puede incrustarlo lo define next.config.ts.
 */
export default async function GeovisorIncrustado({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { abierto, vistaPrevia } = await accesoSitioNV();
  if (!abierto && !vistaPrevia) return <p className="p-6 text-center text-sm text-stone-600">El geovisor de Negocios Verdes estará disponible muy pronto.</p>;
  const d = await datosGeovisorNV(await searchParams);
  return (
    <div className="h-dvh bg-white font-nv text-nv-texto">
      <GeovisorNV {...d} embed />
    </div>
  );
}
