import proj4 from "proj4";

/**
 * MAGNA-SIRGAS / Origen-Nacional (EPSG:9377) — el sistema de coordenadas
 * planas oficial vigente de Colombia (IGAC), reemplazó los antiguos oŕigenes
 * regionales (Bogotá/Este/Oeste). Parámetros verificados contra epsg.io el
 * 2026-08-21 — el factor de escala (0.9992) NO es 1, ojo si se vuelve a
 * transcribir esto de memoria.
 */
const PLANAS = "+proj=tmerc +lat_0=4 +lon_0=-73 +k=0.9992 +x_0=5000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs";

/** Cartesianas geocéntricas (ECEF) sobre el mismo elipsoide GRS80 de MAGNA-SIRGAS. */
const CARTESIANAS = "+proj=geocent +ellps=GRS80 +units=m +no_defs";

export type CoordenadasCompletas = {
  lat: number;
  lon: number;
  altura: number;
  planaX: number;
  planaY: number;
  cartesianaX: number;
  cartesianaY: number;
  cartesianaZ: number;
};

function completarDesdeLatLon(lat: number, lon: number, altura: number): CoordenadasCompletas {
  const [planaX, planaY] = proj4("WGS84", PLANAS, [lon, lat]);
  const [cartesianaX, cartesianaY, cartesianaZ] = proj4("WGS84", CARTESIANAS, [lon, lat, altura]);
  return {
    lat,
    lon,
    altura,
    planaX: round(planaX),
    planaY: round(planaY),
    cartesianaX: round(cartesianaX),
    cartesianaY: round(cartesianaY),
    cartesianaZ: round(cartesianaZ),
  };
}

/** Punto de partida más común: coordenadas elipsoidales (lat/lon de cualquier GPS o mapa). */
export function desdeLatLon(lat: number, lon: number, altura = 0): CoordenadasCompletas {
  return completarDesdeLatLon(lat, lon, altura);
}

/** A partir de coordenadas planas (MAGNA-SIRGAS Origen-Nacional) — ej. de un plano o levantamiento topográfico. */
export function desdePlanas(x: number, y: number): CoordenadasCompletas {
  const [lon, lat] = proj4(PLANAS, "WGS84", [x, y]);
  return completarDesdeLatLon(lat, lon, 0);
}

/** A partir de coordenadas cartesianas geocéntricas (ECEF) — ej. de un receptor GNSS de precisión. */
export function desdeCartesianas(x: number, y: number, z: number): CoordenadasCompletas {
  const [lon, lat, altura] = proj4(CARTESIANAS, "WGS84", [x, y, z]);
  return completarDesdeLatLon(lat, lon, altura);
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function esLatLonValido(lat: number, lon: number) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

// Rangos aproximados válidos dentro de Colombia, para detectar de una vez un typo
// (ej. X e Y invertidos) en vez de guardar un punto sin sentido en otro continente.
export function esPlanaColombiaAprox(x: number, y: number) {
  return Number.isFinite(x) && Number.isFinite(y) && x > 3_500_000 && x < 6_500_000 && y > 500_000 && y < 3_000_000;
}

export function esCartesianaValida(x: number, y: number, z: number) {
  return [x, y, z].every(Number.isFinite) && Math.abs(x) < 7_000_000 && Math.abs(y) < 7_000_000 && Math.abs(z) < 7_000_000;
}
