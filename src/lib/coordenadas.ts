import proj4 from "proj4";

/**
 * MAGNA-SIRGAS / Origen-Nacional (EPSG:9377) — el sistema de coordenadas
 * planas oficial vigente de Colombia (IGAC), reemplazó los antiguos oŕigenes
 * regionales (Bogotá/Este/Oeste). Parámetros verificados contra epsg.io el
 * 2026-08-21 — el factor de escala (0.9992) NO es 1, ojo si se vuelve a
 * transcribir esto de memoria.
 */
const MAGNA_SIRGAS_ORIGEN_NACIONAL =
  "+proj=tmerc +lat_0=4 +lon_0=-73 +k=0.9992 +x_0=5000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs";

export type CoordenadasPlanas = { x: number; y: number };

/** lat/lon en WGS84 (lo que da cualquier GPS/mapa) -> planas MAGNA-SIRGAS Origen-Nacional, en metros. */
export function latLonAPlanas(lat: number, lon: number): CoordenadasPlanas {
  const [x, y] = proj4("WGS84", MAGNA_SIRGAS_ORIGEN_NACIONAL, [lon, lat]);
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
}

export function esLatLonValido(lat: number, lon: number) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}
