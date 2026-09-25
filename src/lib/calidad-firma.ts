export type CalidadFirmaValor = "PRINCIPAL" | "PROYECTO" | "REVISO";
export type CalidadPresentacion = CalidadFirmaValor | "VISTO_BUENO";

export const CALIDADES_FIRMA: CalidadFirmaValor[] = ["PRINCIPAL", "PROYECTO", "REVISO"];
export const OPCIONES_CALIDAD_ASIGNACION: CalidadPresentacion[] = ["PRINCIPAL", "PROYECTO", "REVISO", "VISTO_BUENO"];

export const ETIQUETA_CALIDAD_FIRMA: Record<CalidadPresentacion, string> = {
  PRINCIPAL: "Firmante principal",
  PROYECTO: "Proyectó",
  REVISO: "Revisó",
  VISTO_BUENO: "Visto bueno",
};

const ORDEN: Record<CalidadPresentacion, number> = { PRINCIPAL: 0, PROYECTO: 1, REVISO: 2, VISTO_BUENO: 3 };

export function esCalidadFirma(valor: unknown): valor is CalidadFirmaValor {
  return typeof valor === "string" && (CALIDADES_FIRMA as string[]).includes(valor);
}

function esCalidadPresentacion(valor: unknown): valor is CalidadPresentacion {
  return typeof valor === "string" && (OPCIONES_CALIDAD_ASIGNACION as string[]).includes(valor);
}

export function rotuloCalidadFirma(calidad: string | null | undefined): string | null {
  if (calidad === "PROYECTO" || calidad === "REVISO" || calidad === "VISTO_BUENO") return ETIQUETA_CALIDAD_FIRMA[calidad];
  return null;
}

export function calidadDeSolicitud(s: { rol: string; calidad?: string | null }): CalidadPresentacion {
  if (s.rol === "VISTO_BUENO") return "VISTO_BUENO";
  return esCalidadFirma(s.calidad) ? s.calidad : "PRINCIPAL";
}

export function etiquetaCalidadCompleta(s: { rol: string; calidad?: string | null }): string {
  return ETIQUETA_CALIDAD_FIRMA[calidadDeSolicitud(s)];
}

export function nivelSello(calidad: string | null | undefined): "principal" | "secundaria" | "visto" {
  if (calidad === "VISTO_BUENO") return "visto";
  if (calidad === "PROYECTO" || calidad === "REVISO") return "secundaria";
  return "principal";
}

export function ordenarPorCalidad<T>(items: T[], calidad: (item: T) => string | null | undefined): T[] {
  const peso = (item: T) => {
    const c = calidad(item);
    return esCalidadPresentacion(c) ? ORDEN[c] : ORDEN.PRINCIPAL;
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
