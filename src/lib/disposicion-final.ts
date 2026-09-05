import type { DisposicionFinal } from "@prisma/client";

/**
 * Ciclo de vida archivístico de un documento (Ley 594/2000 + Acuerdo 004/2019
 * AGN): archivo de GESTIÓN (en la oficina que lo produjo) → archivo CENTRAL
 * (transferido, retención adicional) → DISPOSICIÓN FINAL (conservación
 * permanente, eliminación, selección, o microfilmación/digitalización, según
 * lo que diga la TRD de su subserie). Se cuenta desde la fecha de radicación.
 */

export function sumarAnios(fecha: Date, anios: number): Date {
  const d = new Date(fecha);
  d.setUTCFullYear(d.getUTCFullYear() + anios);
  return d;
}

export type FaseArchivistica = "GESTION" | "TRANSFERENCIA_PENDIENTE" | "DISPOSICION_PENDIENTE";

export const ETIQUETA_FASE: Record<FaseArchivistica, string> = {
  GESTION: "En archivo de gestión",
  TRANSFERENCIA_PENDIENTE: "Pendiente de transferir a archivo central",
  DISPOSICION_PENDIENTE: "Pendiente de disposición final",
};

export function calcularFaseArchivistica(
  fechaRadicacion: Date,
  retencionGestionAnios: number,
  retencionCentralAnios: number,
  ahora: Date = new Date()
): { fase: FaseArchivistica; fechaFinGestion: Date; fechaFinCentral: Date } {
  const fechaFinGestion = sumarAnios(fechaRadicacion, retencionGestionAnios);
  const fechaFinCentral = sumarAnios(fechaFinGestion, retencionCentralAnios);
  const fase: FaseArchivistica =
    ahora < fechaFinGestion ? "GESTION" : ahora < fechaFinCentral ? "TRANSFERENCIA_PENDIENTE" : "DISPOSICION_PENDIENTE";
  return { fase, fechaFinGestion, fechaFinCentral };
}

/** Eliminación/selección destruyen el original y por eso exigen un acta formal (comité de archivo). */
export const REQUIERE_ACTA: Record<DisposicionFinal, boolean> = {
  CONSERVACION_TOTAL: false,
  ELIMINACION: true,
  SELECCION: true,
  MICROFILMACION_DIGITALIZACION: false,
};
