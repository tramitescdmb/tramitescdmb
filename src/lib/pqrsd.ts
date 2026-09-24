import type { TipoPQRSD } from "@prisma/client";
import { sumarDiasHabiles, diasHabilesEntre, type CalendarioLaboral } from "@/lib/dias-habiles";

export const TERMINO_DIAS_HABILES: Record<TipoPQRSD, number> = {
  PETICION_GENERAL: 15,
  PETICION_DOCUMENTOS: 10,
  CONSULTA: 30,
  QUEJA: 15,
  RECLAMO: 15,
  SUGERENCIA: 15,
  DENUNCIA: 15,
};

export const ETIQUETA_TIPO_PQRSD: Record<TipoPQRSD, string> = {
  PETICION_GENERAL: "Petición",
  PETICION_DOCUMENTOS: "Petición de documentos/información",
  CONSULTA: "Consulta",
  QUEJA: "Queja",
  RECLAMO: "Reclamo",
  SUGERENCIA: "Sugerencia",
  DENUNCIA: "Denuncia",
};

export function calcularVencimiento(fechaRadicacion: Date, tipo: TipoPQRSD, cal?: CalendarioLaboral): Date {
  return sumarDiasHabiles(fechaRadicacion, TERMINO_DIAS_HABILES[tipo], cal);
}

export function calcularVencimientoTrasReactivar(
  fechaRadicacion: Date,
  fechaSuspension: Date,
  ahora: Date,
  terminoDiasHabiles: number,
  cal?: CalendarioLaboral
): Date {
  const transcurridos = diasHabilesEntre(fechaRadicacion, fechaSuspension, cal);
  const restantes = Math.max(1, terminoDiasHabiles - transcurridos);
  return sumarDiasHabiles(ahora, restantes, cal);
}

export type EstadoVencimiento = { texto: string; clase: string };

export function devolucionDeReparoPermitida(
  fechaVencimiento: Date | null,
  cal?: CalendarioLaboral,
  ahora: Date = new Date(),
  minDiasHabiles = 3
): boolean {
  if (!fechaVencimiento) return true;
  if (fechaVencimiento.getTime() <= ahora.getTime()) return false;
  return diasHabilesEntre(ahora, fechaVencimiento, cal) > minDiasHabiles;
}

export function estadoVencimiento(
  fechaVencimiento: Date | null,
  ahora: Date = new Date(),
  cal?: CalendarioLaboral
): EstadoVencimiento | null {
  if (!fechaVencimiento) return null;
  if (fechaVencimiento.getTime() < ahora.getTime()) return { texto: "Vencido", clase: "bg-red-50 text-red-700" };
  const dias = diasHabilesEntre(ahora, fechaVencimiento, cal);
  if (dias <= 3) return { texto: `Vence en ${dias} d.h.`, clase: "bg-amber-50 text-amber-700" };
  return { texto: `${dias} d.h. restantes`, clase: "bg-emerald-50 text-emerald-700" };
}
