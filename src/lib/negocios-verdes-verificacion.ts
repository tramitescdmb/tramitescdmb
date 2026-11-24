/**
 * Verificador de datos de Negocios Verdes (puro): correo bien escrito y coordenadas dentro de la
 * jurisdicción de la CDMB (los 13 municipios). Lo usan el formulario, la importación CSV y la
 * página «Revisión de datos» del panel.
 *
 * Los límites son los de public/geo/municipios_cdmb.geojson (OpenStreetMap simplificado a ~200 m),
 * copiados en src/lib/geo para poder importarlos; una prueba verifica que sean idénticos. Por esa
 * simplificación se acepta un margen de ~400 m alrededor de la jurisdicción.
 */
import municipiosGeo from "@/lib/geo/municipios-cdmb.json";
import { normalizarTexto } from "@/lib/negocios-verdes";

type Anillo = number[][];
const MUNICIPIOS = (municipiosGeo as { features: { properties: { nombre: string }; geometry: { coordinates: Anillo[] } }[] }).features.map((f) => ({
  nombre: f.properties.nombre,
  anillos: f.geometry.coordinates,
}));
const MARGEN_KM = 0.4;

function dentroDeAnillo(lng: number, lat: number, anillo: Anillo): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i]!;
    const [xj, yj] = anillo[j]!;
    if (yi! > lat !== yj! > lat && lng < ((xj! - xi!) * (lat - yi!)) / (yj! - yi!) + xi!) dentro = !dentro;
  }
  return dentro;
}

/** Distancia aproximada (km) del punto al borde del anillo. */
function distanciaKm(lng: number, lat: number, anillo: Anillo): number {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.57;
  let min = Infinity;
  for (let i = 0; i < anillo.length - 1; i++) {
    const ax = (anillo[i]![0]! - lng) * kx, ay = (anillo[i]![1]! - lat) * ky;
    const bx = (anillo[i + 1]![0]! - lng) * kx, by = (anillo[i + 1]![1]! - lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
    min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return min;
}

/** Municipio de la jurisdicción donde cae el punto (con el margen), o null si está fuera. */
export function municipioDelPunto(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const m of MUNICIPIOS) {
    const [exterior, ...huecos] = m.anillos;
    if (exterior && dentroDeAnillo(lng, lat, exterior) && !huecos.some((h) => dentroDeAnillo(lng, lat, h))) return m.nombre;
  }
  let cercano: { nombre: string; d: number } | null = null;
  for (const m of MUNICIPIOS) {
    const d = distanciaKm(lng, lat, m.anillos[0]!);
    if (d <= MARGEN_KM && (!cercano || d < cercano.d)) cercano = { nombre: m.nombre, d };
  }
  return cercano?.nombre ?? null;
}

export type ResultadoUbicacion = { errores: string[]; avisos: string[] };

/**
 * Coordenadas: las dos o ninguna, y dentro de los 13 municipios. Si están fuera, sugiere la causa
 * típica (latitud y longitud invertidas, o longitud sin el signo menos). Si caen en otro municipio
 * del que dice el negocio, es un aviso (el límite es aproximado), no un error.
 */
export function verificarUbicacion(lat: number | null, lng: number | null, municipio?: string | null): ResultadoUbicacion {
  const r: ResultadoUbicacion = { errores: [], avisos: [] };
  if (lat === null && lng === null) return r;
  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    r.errores.push("Escriba latitud y longitud juntas, o ninguna.");
    return r;
  }
  const donde = municipioDelPunto(lat, lng);
  if (!donde) {
    let pista = "";
    if (municipioDelPunto(lng, lat)) pista = " Parece que latitud y longitud están invertidas.";
    else if (lng > 0 && municipioDelPunto(lat, -lng)) pista = " A la longitud le falta el signo menos.";
    else if (lat < 0 && municipioDelPunto(-lat, lng)) pista = " La latitud no lleva signo menos.";
    r.errores.push(`Las coordenadas quedan fuera de la jurisdicción de la CDMB (13 municipios).${pista}`);
    return r;
  }
  if (municipio && normalizarTexto(municipio) !== normalizarTexto(donde)) r.avisos.push(`Las coordenadas caen en ${donde}, no en ${municipio}.`);
  return r;
}

const DOMINIOS_MAL_ESCRITOS: Record<string, string> = {
  "gmail.con": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.om": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.es": "gmail.com",
  "gmailcom": "gmail.com",
  "hotmail.con": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "homail.com": "hotmail.com",
  "hotmailcom": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlook.con": "outlook.com",
  "outlookcom": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yahooo.com": "yahoo.com",
};

/** Devuelve el motivo si el correo está mal escrito, o null si está bien. */
export function problemaCorreo(correo: string | null | undefined): string | null {
  const c = (correo ?? "").trim();
  if (!c) return null;
  if ((c.match(/@/g) ?? []).length > 1) return "Tiene más de un correo: escriba solo uno.";
  if (!c.includes("@")) return "Al correo le falta la @.";
  if (/\s/.test(c)) return "El correo tiene espacios.";
  const [local, dominio] = c.toLowerCase().split("@") as [string, string];
  const sugerido = DOMINIOS_MAL_ESCRITOS[dominio];
  if (sugerido) return `El dominio parece mal escrito: ¿quiso decir ${local}@${sugerido}?`;
  if (!local || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return "El correo tiene un punto mal puesto antes de la @.";
  if (!/^[a-z0-9._%+'-]+$/.test(local)) return "El correo tiene caracteres no válidos.";
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/.test(dominio) || dominio.split(".").some((p) => !p || p.startsWith("-") || p.endsWith("-"))) return "El dominio del correo está incompleto o mal escrito.";
  return null;
}
