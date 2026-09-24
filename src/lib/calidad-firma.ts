export type CalidadFirmaValor = "PRINCIPAL" | "PROYECTO" | "REVISO";

export const CALIDADES_FIRMA: CalidadFirmaValor[] = ["PRINCIPAL", "PROYECTO", "REVISO"];

export const ETIQUETA_CALIDAD_FIRMA: Record<CalidadFirmaValor, string> = {
  PRINCIPAL: "Firmante principal",
  PROYECTO: "Proyectó",
  REVISO: "Revisó",
};

const ORDEN: Record<CalidadFirmaValor, number> = { PRINCIPAL: 0, PROYECTO: 1, REVISO: 2 };

export function esCalidadFirma(valor: unknown): valor is CalidadFirmaValor {
  return typeof valor === "string" && (CALIDADES_FIRMA as string[]).includes(valor);
}

export function rotuloCalidadFirma(calidad: string | null | undefined): string | null {
  if (calidad === "PROYECTO" || calidad === "REVISO") return ETIQUETA_CALIDAD_FIRMA[calidad];
  return null;
}

export function ordenarPorCalidad<T>(items: T[], calidad: (item: T) => string | null | undefined): T[] {
  const peso = (item: T) => {
    const c = calidad(item);
    return esCalidadFirma(c) ? ORDEN[c] : ORDEN.PRINCIPAL;
  };
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => peso(a.item) - peso(b.item) || a.i - b.i)
    .map((x) => x.item);
}
