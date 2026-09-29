import { FilePlus, RefreshCw, ArrowRight, Paperclip, Trash2, MessageSquare, Users, MapPin, Circle, FilePen, FileSignature, CheckCircle2, FileX2, Send, ThumbsUp, type LucideIcon } from "lucide-react";

const EVENTOS: Record<string, { icono: LucideIcon; etiqueta: string; clase: string }> = {
  CREACION: { icono: FilePlus, etiqueta: "Creación del expediente", clase: "bg-cdmb-100 text-cdmb-700" },
  CAMBIO_ESTADO: { icono: RefreshCw, etiqueta: "Cambio de estado", clase: "bg-amber-100 text-amber-700" },
  AVANCE_PASO: { icono: ArrowRight, etiqueta: "Avance de paso", clase: "bg-sky-100 text-sky-700" },
  DOCUMENTO_SUBIDO: { icono: Paperclip, etiqueta: "Documento adjuntado", clase: "bg-violet-100 text-violet-700" },
  DOCUMENTO_EDITADO: { icono: FilePen, etiqueta: "Documento editado", clase: "bg-stone-200 text-stone-600" },
  DOCUMENTO_ELIMINADO: { icono: Trash2, etiqueta: "Documento eliminado", clase: "bg-red-100 text-red-700" },
  DOCUMENTO_FIRMADO: { icono: FileSignature, etiqueta: "Documento firmado", clase: "bg-emerald-100 text-emerald-700" },
  DOCUMENTO_VALIDADO: { icono: CheckCircle2, etiqueta: "Documento validado", clase: "bg-emerald-100 text-emerald-700" },
  DOCUMENTO_RECHAZADO: { icono: FileX2, etiqueta: "Documento rechazado", clase: "bg-red-100 text-red-700" },
  FIRMA_SOLICITADA: { icono: Send, etiqueta: "Firma o visto bueno solicitado", clase: "bg-cdmb-100 text-cdmb-700" },
  VISTO_BUENO_DADO: { icono: ThumbsUp, etiqueta: "Visto bueno dado", clase: "bg-emerald-100 text-emerald-700" },
  COMENTARIO: { icono: MessageSquare, etiqueta: "Comentario", clase: "bg-stone-200 text-stone-600" },
  ASIGNACION_CAMBIADA: { icono: Users, etiqueta: "Asignación cambiada", clase: "bg-teal-100 text-teal-700" },
  VISITA_REGISTRADA: { icono: MapPin, etiqueta: "Visita técnica registrada", clase: "bg-emerald-100 text-emerald-700" },
};
const EVENTO_DEFECTO = { icono: Circle, clase: "bg-stone-200 text-stone-600" };

export function infoEvento(tipo: string) {
  return EVENTOS[tipo] ?? { ...EVENTO_DEFECTO, etiqueta: tipo };
}
