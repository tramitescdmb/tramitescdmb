import { dentroDeZonaCdmb, puntoDesdeNorteEste, puntoDesdeTexto } from "@/lib/coordenadas-texto";

export type LineaInterpretada = { linea: number; texto: string; punto: [number, number] | null };

const PATRON_DMS =
  /(-?\d{1,3})\s*[°º]\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*['’′]\s*)?(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:["”″]|''|’’)\s*)?([NSEWO])?/gi;

function numero(v: string): number {
  return Number(v.replace(",", "."));
}

function desdeDms(texto: string): [number, number] | null {
  const partes = [...texto.matchAll(PATRON_DMS)];
  if (partes.length !== 2) return null;
  const valores = partes.map((m) => {
    const grados = Math.abs(numero(m[1]!));
    const valor = grados + (m[2] ? numero(m[2]) / 60 : 0) + (m[3] ? numero(m[3]) / 3600 : 0);
    const hemisferio = m[4]?.toUpperCase();
    const negativo = m[1]!.startsWith("-") || hemisferio === "S" || hemisferio === "W" || hemisferio === "O";
    return { valor: negativo ? -valor : valor, esLon: hemisferio === "E" || hemisferio === "W" || hemisferio === "O" };
  });
  let [a, b] = valores as [(typeof valores)[0], (typeof valores)[0]];
  if (a.esLon && !b.esLon) [a, b] = [b, a];
  return ordenarLatLon(a.valor, b.valor);
}

function ordenarLatLon(x: number, y: number): [number, number] | null {
  if (dentroDeZonaCdmb(x, y)) return [x, y];
  if (dentroDeZonaCdmb(y, x)) return [y, x];
  if (dentroDeZonaCdmb(x, -Math.abs(y))) return [x, -Math.abs(y)];
  if (dentroDeZonaCdmb(y, -Math.abs(x))) return [y, -Math.abs(x)];
  return null;
}

function dividir(texto: string): string[] {
  const limpio = texto.trim();
  if (/[;\t|]/.test(limpio)) return limpio.split(/[;\t|]+/).map((s) => s.trim()).filter(Boolean);
  if (/,\s/.test(limpio)) return limpio.split(/,\s+/).map((s) => s.trim()).filter(Boolean);
  const porEspacio = limpio.split(/\s+/).filter(Boolean);
  if (porEspacio.length >= 2) return porEspacio;
  const comas = limpio.split(",");
  if (comas.length === 2 && comas.every((c) => /^-?\d+(\.\d+)?$/.test(c.trim()))) return comas;
  return [limpio];
}

function esNumero(s: string): boolean {
  return /^-?\d[\d.,]*$/.test(s);
}

export function interpretarLinea(texto: string): [number, number] | null {
  const t = texto.trim();
  if (!t) return null;
  if (/[°º]/.test(t)) return desdeDms(t);
  const etiquetado = puntoDesdeTexto(t);
  if (etiquetado) return [etiquetado.lat, etiquetado.lon];
  const numeros = dividir(t).filter(esNumero);
  if (numeros.length < 2) return null;
  const [x, y] = numeros.slice(-2) as [string, string];
  const a = numero(x);
  const b = numero(y);
  if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 180 && Math.abs(b) <= 180) return ordenarLatLon(a, b);
  const plana = puntoDesdeNorteEste(x, y);
  return plana ? [plana.lat, plana.lon] : null;
}

export function interpretarPuntos(texto: string): LineaInterpretada[] {
  return texto
    .split(/\r?\n/)
    .map((linea, i) => ({ linea: i + 1, texto: linea.trim(), punto: interpretarLinea(linea) }))
    .filter((l) => l.texto !== "");
}
