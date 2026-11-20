export const ESTADOS_EXPEDIENTE = [
  "RADICADO",
  "EN_TRAMITE",
  "INFORMACION_ADICIONAL_REQUERIDA",
  "SUSPENDIDO",
  "APROBADO",
  "NEGADO",
  "DESISTIDO",
  "ARCHIVADO",
  "RECHAZADO",
] as const;

export const ESTADOS_TERMINALES_EXPEDIENTE = ["APROBADO", "NEGADO", "DESISTIDO", "ARCHIVADO", "RECHAZADO"] as const;

/**
 * Un trámite está FINALIZADO cuando tiene estado final y además se completó el último paso del
 * procedimiento (fechaCierre). Una decisión (aprobar/negar) que todavía deja pasos por delante
 * (p. ej. «Notificar al usuario») pone el estado final pero deja fechaCierre en null hasta que se
 * terminan esos pasos: el trámite queda «resuelto, en notificación», no finalizado.
 */
export function tramiteFinalizado(e: { estado: string; fechaCierre: Date | string | null }): boolean {
  return (ESTADOS_TERMINALES_EXPEDIENTE as readonly string[]).includes(e.estado) && e.fechaCierre != null;
}

/** Filtro Prisma: trámites que aún no han finalizado (incluye los resueltos que faltan por notificar). */
export const FILTRO_TRAMITE_EN_CURSO = {
  OR: [{ estado: { notIn: [...ESTADOS_TERMINALES_EXPEDIENTE] } }, { fechaCierre: null }],
};
