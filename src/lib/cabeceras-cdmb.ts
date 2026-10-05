import type { MunicipioCdmb } from "@/lib/municipios";

export const CABECERAS_CDMB: Record<MunicipioCdmb, [number, number]> = {
  Bucaramanga: [7.1193, -73.1227],
  Floridablanca: [7.0647, -73.0896],
  "Girón": [7.0682, -73.1698],
  Piedecuesta: [6.9881, -73.0503],
  Vetas: [7.3097, -72.8714],
  California: [7.3486, -72.9461],
  "Suratá": [7.3667, -72.9844],
  Matanza: [7.3233, -73.0153],
  Charta: [7.2806, -72.9681],
  Tona: [7.2017, -72.9675],
  "El Playón": [7.4703, -73.2031],
  Rionegro: [7.265, -73.15],
  Lebrija: [7.1139, -73.2181],
};

const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const POR_NOMBRE = new Map(Object.keys(CABECERAS_CDMB).map((m) => [sinTildes(m), m as MunicipioCdmb]));

export function cabeceraDeMunicipio(nombre: string | null | undefined): { municipio: MunicipioCdmb; lat: number; lon: number } | null {
  if (!nombre) return null;
  const clave = sinTildes(nombre);
  const municipio = POR_NOMBRE.get(clave === "b manga" ? "bucaramanga" : clave);
  if (!municipio) return null;
  const [lat, lon] = CABECERAS_CDMB[municipio];
  return { municipio, lat, lon };
}
