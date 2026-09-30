// Prueba punto-en-polígono (ray casting) contra el límite de los 13 municipios de la jurisdicción
// CDMB (public/geo/municipios_cdmb.geojson). Puro — sin `fs`, así que es seguro importarlo tanto desde
// componentes cliente (que hacen fetch del GeoJSON público) como desde el servidor.
export type AnilloGeoJson = [number, number][];
export type GeometriaPoligono = { type: "Polygon"; coordinates: AnilloGeoJson[] } | { type: "MultiPolygon"; coordinates: AnilloGeoJson[][] };
export type ColeccionPoligonos = { features: { geometry: GeometriaPoligono }[] };

function puntoEnAnillo(lat: number, lon: number, anillo: AnilloGeoJson): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i]!;
    const [xj, yj] = anillo[j]!;
    const interseca = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (interseca) dentro = !dentro;
  }
  return dentro;
}

function puntoEnPoligonoConHuecos(lat: number, lon: number, anillos: AnilloGeoJson[]): boolean {
  if (anillos.length === 0 || !puntoEnAnillo(lat, lon, anillos[0]!)) return false;
  for (let k = 1; k < anillos.length; k++) {
    if (puntoEnAnillo(lat, lon, anillos[k]!)) return false; // cae en un hueco del polígono
  }
  return true;
}

export function puntoEnGeometria(lat: number, lon: number, geom: GeometriaPoligono): boolean {
  const poligonos = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  return poligonos.some((anillos) => puntoEnPoligonoConHuecos(lat, lon, anillos));
}

export function puntoDentroDeFeatures(lat: number, lon: number, coleccion: ColeccionPoligonos): boolean {
  return coleccion.features.some((f) => puntoEnGeometria(lat, lon, f.geometry));
}

let cacheGeojson: Promise<ColeccionPoligonos> | null = null;

export function cargarJurisdiccionCdmb(): Promise<ColeccionPoligonos> {
  cacheGeojson ??= fetch("/geo/municipios_cdmb.geojson").then((r) => r.json());
  return cacheGeojson;
}
