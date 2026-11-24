import type { Metadata } from "next";
import { datosGeovisorNV } from "@/lib/negocios-verdes-geovisor-data";
import { GeovisorNV } from "@/components/negocios-verdes/GeovisorNV";

export const metadata: Metadata = {
  title: "Geovisor",
  description: "Mapa de los negocios verdes de los 13 municipios de la jurisdicción de la CDMB, con áreas protegidas, páramos, veredas e hidrografía.",
};

export default async function GeovisorNegociosVerdes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const d = await datosGeovisorNV(await searchParams);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Geovisor</h1>
        <p className="text-sm text-stone-600">Ubique los negocios verdes en el mapa y consulte las áreas de importancia ambiental de la jurisdicción.</p>
      </div>
      <GeovisorNV {...d} />
    </div>
  );
}
