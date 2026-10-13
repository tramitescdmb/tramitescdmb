import { formatearPesosCO } from "@/lib/moneda";

export type TopeCuantia = { anio: number; menorCuantia: number; soporte: string | null };

export const PORCENTAJE_MINIMA_CUANTIA = 0.1;

export function minimaCuantia(tope: Pick<TopeCuantia, "menorCuantia">): number {
  return Math.floor(tope.menorCuantia * PORCENTAJE_MINIMA_CUANTIA);
}

const PREVALECE_MINIMA = new Set([
  "LICITACION_PUBLICA",
  "SELECCION_ABREVIADA_MENOR_CUANTIA",
  "SELECCION_ABREVIADA_SUBASTA_INVERSA",
  "SELECCION_ABREVIADA_ACUERDO_MARCO",
  "SELECCION_ABREVIADA_BOLSA_PRODUCTOS",
  "CONCURSO_MERITOS",
]);

export function errorCuantia(modalidad: string, valor: number | null, tope: TopeCuantia | null): string | null {
  if (!tope || valor === null || !Number.isFinite(valor) || valor <= 0) return null;
  const minima = minimaCuantia(tope);
  const menor = tope.menorCuantia;
  const sufijo = `(topes ${tope.anio}: menor cuantía ${formatearPesosCO(menor)}, mínima cuantía ${formatearPesosCO(minima)})`;
  if (modalidad === "MINIMA_CUANTIA" && valor > minima) {
    return `El valor supera la mínima cuantía ${sufijo}.`;
  }
  if (PREVALECE_MINIMA.has(modalidad) && valor <= minima) {
    return `Por su valor corresponde a mínima cuantía, que prevalece sin importar el objeto (Ley 2069 de 2020, art. 30) ${sufijo}.`;
  }
  if (modalidad === "SELECCION_ABREVIADA_MENOR_CUANTIA" && valor > menor) {
    return `El valor supera la menor cuantía ${sufijo}.`;
  }
  if (modalidad === "LICITACION_PUBLICA" && valor <= menor) {
    return `Por su valor corresponde a selección abreviada de menor cuantía o, si son bienes y servicios uniformes, a subasta inversa (Ley 1150 de 2007, art. 2, num. 2) ${sufijo}.`;
  }
  return null;
}

export function topeDeAnio(topes: TopeCuantia[], anio: number): TopeCuantia | null {
  return topes.find((t) => t.anio === anio) ?? null;
}
