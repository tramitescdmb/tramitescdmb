export const MUNICIPIOS_JURISDICCION_CDMB = [
  "Bucaramanga",
  "Floridablanca",
  "Girón",
  "Piedecuesta",
  "Vetas",
  "California",
  "Suratá",
  "Matanza",
  "Charta",
  "Tona",
  "El Playón",
  "Rionegro",
  "Lebrija",
] as const;

export type MunicipioCdmb = (typeof MUNICIPIOS_JURISDICCION_CDMB)[number];

export function esMunicipioValido(valor: string): valor is MunicipioCdmb {
  return (MUNICIPIOS_JURISDICCION_CDMB as readonly string[]).includes(valor);
}

export const CENTROIDE_MUNICIPIO: Record<MunicipioCdmb, [number, number]> = {
  Bucaramanga: [7.1193, -73.1227],
  Floridablanca: [7.0631, -73.085],
  Girón: [7.0678, -73.1719],
  Piedecuesta: [6.9897, -73.0508],
  Vetas: [7.3081, -72.8794],
  California: [7.3467, -72.9142],
  Suratá: [7.3672, -72.9803],
  Matanza: [7.3072, -73.0181],
  Charta: [7.2872, -72.9403],
  Tona: [7.2003, -72.9822],
  "El Playón": [7.4917, -73.2011],
  Rionegro: [7.2586, -73.1567],
  Lebrija: [7.1214, -73.2183],
};

export const CENTRO_CDMB_POR_DEFECTO: [number, number] = CENTROIDE_MUNICIPIO.Bucaramanga;

export const FUERA_DE_JURISDICCION = "Fuera de la jurisdicción";
