import proj4 from "proj4";

const MAGNA_BOGOTA = "+proj=tmerc +lat_0=4.596200416666666 +lon_0=-74.07750791666666 +k=1 +x_0=1000000 +y_0=1000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs";
const CTM12 = "+proj=tmerc +lat_0=4 +lon_0=-73 +k=0.9992 +x_0=5000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs";

export type PuntoExtraido = { lat: number; lon: number; origen: "geograficas" | "planas_magna_bogota" | "planas_ctm12" };

const ZONA = { latMin: 5.5, latMax: 9, lonMin: -75.5, lonMax: -71.5 };

export function dentroDeZonaCdmb(lat: number, lon: number): boolean {
  return lat >= ZONA.latMin && lat <= ZONA.latMax && lon >= ZONA.lonMin && lon <= ZONA.lonMax;
}

function aNumero(valor: string): number | null {
  const limpio = valor.trim().replace(/\s/g, "");
  if (!limpio) return null;
  const conPunto = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(limpio)
    ? limpio.replace(/\./g, "").replace(",", ".")
    : limpio.replace(/,(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(conPunto);
  return Number.isFinite(n) ? n : null;
}

function gradosConPuntoPerdido(valor: number, enteros: number): number {
  const signo = valor < 0 ? -1 : 1;
  const digitos = String(Math.abs(Math.trunc(valor)));
  if (digitos.length <= enteros) return valor;
  return signo * Number(`${digitos.slice(0, enteros)}.${digitos.slice(enteros)}`);
}

export function puntoDesdeNorteEste(norteTexto: string, esteTexto: string): PuntoExtraido | null {
  const norte = aNumero(norteTexto);
  const este = aNumero(esteTexto);
  if (norte === null || este === null) return null;

  if (Math.abs(norte) <= 90 || Math.abs(este) <= 180 || Math.abs(este) > 10_000_000) {
    const lat = gradosConPuntoPerdido(norte, 1);
    const lon = gradosConPuntoPerdido(este, 2);
    if (dentroDeZonaCdmb(lat, lon)) return { lat, lon, origen: "geograficas" };
    return null;
  }

  for (const [crs, origen] of [
    [MAGNA_BOGOTA, "planas_magna_bogota"],
    [CTM12, "planas_ctm12"],
  ] as const) {
    const [lon, lat] = proj4(crs, "WGS84", [este, norte]);
    if (dentroDeZonaCdmb(lat, lon)) return { lat, lon, origen };
  }
  return null;
}

const PATRON_NORTE_ESTE =
  /\b(?:N(?:ORTE)?)\s*[:=.]?\s*(-?[\d.,]{6,13})\s*(?:M(?:TS?)?\.?)?\s*[,;Y\-]?\s*(?:Y\s*)?\b(?:E(?:STE)?)\s*[:=.]?\s*(-?[\d.,]{6,13})/i;
const PATRON_ESTE_NORTE =
  /\b(?:E(?:STE)?)\s*[:=.]?\s*(-?[\d.,]{6,13})\s*(?:M(?:TS?)?\.?)?\s*[,;Y\-]?\s*(?:Y\s*)?\b(?:N(?:ORTE)?)\s*[:=.]?\s*(-?[\d.,]{6,13})/i;
const PATRON_LAT_LON = /\b(?:LAT(?:ITUD)?)\s*[:=.]?\s*(-?\d{1,2}[.,]\d{3,})\D{1,25}(?:LON(?:G(?:ITUD)?)?)\s*[:=.]?\s*(-?\d{2,3}[.,]\d{3,})/i;

export function puntoDesdeTexto(texto: string | null | undefined): PuntoExtraido | null {
  if (!texto) return null;
  const ne = texto.match(PATRON_NORTE_ESTE);
  if (ne) {
    const p = puntoDesdeNorteEste(ne[1]!, ne[2]!);
    if (p) return p;
  }
  const en = texto.match(PATRON_ESTE_NORTE);
  if (en) {
    const p = puntoDesdeNorteEste(en[2]!, en[1]!);
    if (p) return p;
  }
  const ll = texto.match(PATRON_LAT_LON);
  if (ll) {
    const lat = aNumero(ll[1]!);
    const lon = aNumero(ll[2]!);
    if (lat !== null && lon !== null && dentroDeZonaCdmb(lat, lon)) return { lat, lon, origen: "geograficas" };
  }
  return null;
}

export function puntoDesdeCampos(campos: unknown): PuntoExtraido | null {
  if (!campos || typeof campos !== "object" || Array.isArray(campos)) return null;
  const entradas = Object.entries(campos as Record<string, unknown>).map(([k, v]) => [k.trim().toLowerCase(), typeof v === "string" ? v : v == null ? "" : String(v)] as const);
  const buscar = (re: RegExp) => entradas.find(([k, v]) => re.test(k) && v.trim() !== "")?.[1] ?? null;
  const norte = buscar(/^(coordenada\s*)?norte\W*$/) ?? buscar(/^latitud\W*$/);
  const este = buscar(/^(coordenada\s*)?este\W*$/) ?? buscar(/^longitud\W*$/);
  if (norte && este) {
    const p = puntoDesdeNorteEste(norte, este);
    if (p) return p;
  }
  for (const [k, v] of entradas) {
    if (!/coordenad|ubicaci|localizaci/.test(k) || !v.trim()) continue;
    const p = puntoDesdeTexto(v);
    if (p) return p;
  }
  return null;
}

export const ETIQUETA_ORIGEN_COORDENADA: Record<PuntoExtraido["origen"], string> = {
  geograficas: "geográficas (WGS84)",
  planas_magna_bogota: "planas MAGNA-SIRGAS origen Bogotá",
  planas_ctm12: "planas MAGNA-SIRGAS origen nacional (CTM12)",
};
