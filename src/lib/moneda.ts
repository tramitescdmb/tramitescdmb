/**
 * Formato de valores monetarios en pesos colombianos — sin decimales (el peso
 * no usa centavos en la práctica administrativa) y con separador de miles
 * "." propio de la configuración regional es-CO.
 */
export function formatearPesosCO(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const numero = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(numero)) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(numero);
}

/** Quita todo lo que no sea dígito — para leer de vuelta un valor formateado con separadores de miles. */
export function limpiarNumero(texto: string): string {
  return texto.replace(/[^\d]/g, "");
}

/** Formatea un número entero con separador de miles es-CO, sin símbolo de moneda (para mostrar dentro de un input). */
export function formatearMilesCO(valor: string | number): string {
  const limpio = typeof valor === "number" ? String(valor) : limpiarNumero(valor);
  if (!limpio) return "";
  return new Intl.NumberFormat("es-CO").format(Number(limpio));
}
