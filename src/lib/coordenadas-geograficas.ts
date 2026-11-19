/**
 * Coordenadas geográficas (latitud y longitud) en grados, minutos y segundos
 * o en grados decimales. Datum WGS84 / MAGNA-SIRGAS (equivalentes a efectos
 * prácticos). Sin dependencias para poder usarse en el navegador y en el PDF.
 */

export type Hemisferio = "N" | "S" | "E" | "O";

/** Rango aproximado de Santander y la jurisdicción de la CDMB (solo advertencia). */
export const RANGO_SANTANDER = { latMin: 5.5, latMax: 8.5, lonMin: -74.5, lonMax: -72.5 } as const;

function numero(texto: string): number {
  const limpio = texto.trim().replace(",", ".");
  return limpio === "" ? 0 : Number(limpio);
}

/**
 * Convierte grados, minutos y segundos a grados decimales. Devuelve null si
 * algún valor no es válido (minutos o segundos fuera de 0–59,999…, grados por
 * fuera de 0–90 en latitud o 0–180 en longitud).
 */
export function gmsADecimal(
  grados: string,
  minutos: string,
  segundos: string,
  hemisferio: Hemisferio,
): number | null {
  if (!grados.trim()) return null;
  const g = numero(grados);
  const m = numero(minutos);
  const s = numero(segundos);
  if (![g, m, s].every(Number.isFinite)) return null;
  if (g < 0 || m < 0 || s < 0 || m >= 60 || s >= 60) return null;
  const esLat = hemisferio === "N" || hemisferio === "S";
  const valor = g + m / 60 + s / 3600;
  if (valor > (esLat ? 90 : 180)) return null;
  return hemisferio === "S" || hemisferio === "O" ? -valor : valor;
}

/** Descompone un valor decimal en grados, minutos y segundos (segundos con 2 decimales). */
export function decimalAGms(valor: number, esLat: boolean) {
  const hemisferio: Hemisferio = esLat ? (valor >= 0 ? "N" : "S") : valor >= 0 ? "E" : "O";
  // Redondeo a centésimas de segundo antes de descomponer, para no mostrar 60″.
  const centesimas = Math.round(Math.abs(valor) * 360000);
  const grados = Math.floor(centesimas / 360000);
  const minutos = Math.floor((centesimas % 360000) / 6000);
  const segundos = (centesimas % 6000) / 100;
  return { grados, minutos, segundos, hemisferio };
}

/** Texto en grados, minutos y segundos: 7° 7' 9,66" N */
export function aGms(valor: number, esLat: boolean): string {
  const { grados, minutos, segundos, hemisferio } = decimalAGms(valor, esLat);
  return `${grados}° ${minutos}' ${segundos.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}" ${hemisferio}`;
}

/**
 * Advertencia (no bloquea) cuando el punto queda por fuera del rango
 * aproximado de Santander. Devuelve null si está dentro.
 */
export function avisoFueraDeSantander(lat: number, lon: number): string | null {
  const r = RANGO_SANTANDER;
  const latOk = lat >= r.latMin && lat <= r.latMax;
  const lonOk = lon >= r.lonMin && lon <= r.lonMax;
  if (latOk && lonOk) return null;
  if (!lonOk && lon > 0 && -lon >= r.lonMin && -lon <= r.lonMax) {
    return "La longitud es positiva (Este). En Santander la longitud es Oeste (negativa). Verifique el signo o el hemisferio.";
  }
  if (!latOk && !lonOk && lon >= 5 && lon <= 9 && lat <= -72 && lat >= -75) {
    return "Parece que la latitud y la longitud están invertidas. Verifique el orden de los valores.";
  }
  return "El punto queda por fuera de Santander (latitud 5,5° a 8,5° N; longitud 72,5° a 74,5° O). Verifique las coordenadas antes de continuar.";
}
