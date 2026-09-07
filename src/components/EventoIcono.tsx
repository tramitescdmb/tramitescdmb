import { FilePlus, RefreshCw, ArrowRight, Paperclip, Trash2, MessageSquare, Users, MapPin, Circle, type LucideIcon } from "lucide-react";

const EVENTOS: Record<string, { icono: LucideIcon; etiqueta: string; clase: string }> = {
  CREACION: { icono: FilePlus, etiqueta: "Creación del expediente", clase: "bg-cdmb-100 text-cdmb-700" },
  CAMBIO_ESTADO: { icono: RefreshCw, etiqueta: "Cambio de estado", clase: "bg-amber-100 text-amber-700" },
  AVANCE_PASO: { icono: ArrowRight, etiqueta: "Avance de paso", clase: "bg-sky-100 text-sky-700" },
  DOCUMENTO_SUBIDO: { icono: Paperclip, etiqueta: "Documento adjuntado", clase: "bg-violet-100 text-violet-700" },
  DOCUMENTO_ELIMINADO: { icono: Trash2, etiqueta: "Documento eliminado", clase: "bg-red-100 text-red-700" },
  COMENTARIO: { icono: MessageSquare, etiqueta: "Comentario", clase: "bg-stone-200 text-stone-600" },
  ASIGNACION_CAMBIADA: { icono: Users, etiqueta: "Asignación cambiada", clase: "bg-teal-100 text-teal-700" },
  VISITA_REGISTRADA: { icono: MapPin, etiqueta: "Visita técnica registrada", clase: "bg-emerald-100 text-emerald-700" },
};
const EVENTO_DEFECTO = { icono: Circle, clase: "bg-stone-200 text-stone-600" };

/** Ícono, etiqueta y color por tipo de evento — fuente única para la línea de tiempo del expediente. */
export function infoEvento(tipo: string) {
  return EVENTOS[tipo] ?? { ...EVENTO_DEFECTO, etiqueta: tipo };
}
