export function formatearPesosCO(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const numero = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(numero)) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(numero);
}

export function limpiarNumero(texto: string): string {
  return texto.replace(/[^\d]/g, "");
}

export function formatearMilesCO(valor: string | number): string {
  const limpio = typeof valor === "number" ? String(valor) : limpiarNumero(valor);
  if (!limpio) return "";
  return new Intl.NumberFormat("es-CO").format(Number(limpio));
}
