/** Nivel de acceso a la información (Ley 1712/2014, arts. 6/18/19) — ver prisma/schema.prisma. */
export const ETIQUETA_NIVEL_ACCESO: Record<string, string> = {
  PUBLICA: "Pública",
  CLASIFICADA: "Clasificada",
  RESERVADA: "Reservada",
};

export const CLASE_NIVEL_ACCESO: Record<string, string> = {
  PUBLICA: "bg-stone-100 text-stone-500",
  CLASIFICADA: "bg-amber-50 text-amber-700",
  RESERVADA: "bg-red-50 text-red-700",
};
