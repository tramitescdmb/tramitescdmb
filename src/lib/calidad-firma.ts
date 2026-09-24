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

export type ResumenPendientesFirma = {
  total: number;
  listos: number;
  principal: number;
  proyecto: number;
  reviso: number;
  vistoBueno: number;
};

export const SIN_PENDIENTES_FIRMA: ResumenPendientesFirma = { total: 0, listos: 0, principal: 0, proyecto: 0, reviso: 0, vistoBueno: 0 };

export function resumirPendientesFirma(solicitudes: { rol: string; calidad?: string | null; puedeActuar: boolean }[]): ResumenPendientesFirma {
  const r = { ...SIN_PENDIENTES_FIRMA };
  for (const s of solicitudes) {
    if (s.rol === "FIRMA") {
      if (s.calidad === "PROYECTO") r.proyecto++;
      else if (s.calidad === "REVISO") r.reviso++;
      else r.principal++;
    } else if (s.rol === "VISTO_BUENO") r.vistoBueno++;
    else continue;
    r.total++;
    if (s.puedeActuar) r.listos++;
  }
  return r;
}

export function textoPendientesFirma(r: ResumenPendientesFirma): string {
  const partes = [
    r.principal ? `${r.principal} como firmante principal` : null,
    r.proyecto ? `${r.proyecto} como proyectó` : null,
    r.reviso ? `${r.reviso} como revisó` : null,
    r.vistoBueno ? `${r.vistoBueno} de visto bueno` : null,
  ].filter(Boolean);
  const base = `${r.total} pendiente${r.total === 1 ? "" : "s"} por firmar o revisar`;
  const turno = r.listos < r.total ? ` · ${r.listos} ya puede${r.listos === 1 ? "" : "n"} atenderse` : "";
  return `${base}${partes.length ? `: ${partes.join(", ")}` : ""}${turno}`;
}
