/**
 * Los 13 municipios de la jurisdicción de la CDMB. Un expediente solo puede
 * radicarse si el predio/proyecto queda en uno de estos municipios — la CDMB
 * no tiene competencia por fuera de su jurisdicción.
 *
 * Debe coincidir carácter por carácter (con tildes) con la misma lista en el
 * proyecto Negocios Verdes (lib/catalogos.dart, kMunicipios) — es la misma
 * jurisdicción, no se duplica con criterio propio.
 */
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
