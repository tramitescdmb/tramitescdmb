import type { TipoPQRSD } from "@prisma/client";
import { sumarDiasHabiles, diasHabilesEntre } from "@/lib/dias-habiles";

/**
 * Términos de ley por tipo de PQRSD (Ley 1755/2015, que modificó el Título II
 * del CPACA — Ley 1437/2011, artículos 14 y 158). Contados en días hábiles.
 * Quejas/reclamos/sugerencias/denuncias no tienen un término CPACA propio; se
 * les aplica el término general de peticiones (15 días hábiles) por política
 * institucional, salvo que una norma sectorial fije uno distinto para el caso.
 */
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

export function calcularVencimiento(fechaRadicacion: Date, tipo: TipoPQRSD): Date {
  return sumarDiasHabiles(fechaRadicacion, TERMINO_DIAS_HABILES[tipo]);
}

/**
 * Art. 17 CPACA: cuando se requiere información adicional al peticionario, el
 * término se SUSPENDE y se reanuda (no se reinicia) por los días hábiles que
 * faltaban al momento de la suspensión. El piso de 1 día es defensivo (evita
 * un vencimiento "en el pasado" si ya se había agotado el término al suspender),
 * no es en sí una regla legal.
 */
export function calcularVencimientoTrasReactivar(
  fechaRadicacion: Date,
  fechaSuspension: Date,
  ahora: Date,
  terminoDiasHabiles: number
): Date {
  const transcurridos = diasHabilesEntre(fechaRadicacion, fechaSuspension);
  const restantes = Math.max(1, terminoDiasHabiles - transcurridos);
  return sumarDiasHabiles(ahora, restantes);
}

export type EstadoVencimiento = { texto: string; clase: string };

/** Etiqueta + color para bandeja/detalle según días hábiles restantes hasta el vencimiento. */
export function estadoVencimiento(fechaVencimiento: Date | null, ahora: Date = new Date()): EstadoVencimiento | null {
  if (!fechaVencimiento) return null;
  if (fechaVencimiento.getTime() < ahora.getTime()) return { texto: "Vencido", clase: "bg-red-50 text-red-700" };
  const dias = diasHabilesEntre(ahora, fechaVencimiento);
  if (dias <= 3) return { texto: `Vence en ${dias} d.h.`, clase: "bg-amber-50 text-amber-700" };
  return { texto: `${dias} d.h. restantes`, clase: "bg-stone-100 text-stone-600" };
}
