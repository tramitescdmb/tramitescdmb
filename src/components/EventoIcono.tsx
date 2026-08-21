const EVENTOS: Record<string, { icono: string; etiqueta: string; clase: string }> = {
  CREACION: { icono: "🆕", etiqueta: "Creación del expediente", clase: "bg-cdmb-100 text-cdmb-700" },
  CAMBIO_ESTADO: { icono: "🔄", etiqueta: "Cambio de estado", clase: "bg-amber-100 text-amber-700" },
  AVANCE_PASO: { icono: "➡️", etiqueta: "Avance de paso", clase: "bg-sky-100 text-sky-700" },
  DOCUMENTO_SUBIDO: { icono: "📎", etiqueta: "Documento adjuntado", clase: "bg-violet-100 text-violet-700" },
  DOCUMENTO_ELIMINADO: { icono: "🗑️", etiqueta: "Documento eliminado", clase: "bg-red-100 text-red-700" },
  COMENTARIO: { icono: "💬", etiqueta: "Comentario", clase: "bg-stone-200 text-stone-600" },
  ASIGNACION_CAMBIADA: { icono: "👥", etiqueta: "Asignación cambiada", clase: "bg-teal-100 text-teal-700" },
};
const EVENTO_DEFECTO = { icono: "•", etiqueta: "Evento", clase: "bg-stone-200 text-stone-600" };

/** Ícono, etiqueta y color por tipo de evento — fuente única para la línea de tiempo del expediente. */
export function infoEvento(tipo: string) {
  return EVENTOS[tipo] ?? { ...EVENTO_DEFECTO, etiqueta: tipo };
}
