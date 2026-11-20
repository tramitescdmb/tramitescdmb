/**
 * Reglas para cancelar o eliminar una visita del Planeador como administrador o Subdirector(a)
 * SEYCA. Sin acceso a la base de datos para poder probarlas.
 *
 * - Cancelar conserva la visita con su motivo (queda en el calendario y en el historial). Si ya
 *   tiene hoja de visita, el borrador del concepto técnico se descarta para que no bloquee el
 *   cierre del expediente. No se cancela si el concepto ya se envió a firma.
 * - Eliminar borra la visita de forma definitiva y solo se permite si no tiene hoja de visita
 *   (ni concepto técnico ni firmas): lo registrado en campo nunca se borra; se cancela.
 */

export type HojaParaAnular = {
  finalizadaEn: Date | null;
  conceptoNumero: string | null;
  documentoConceptoId: string | null;
} | null;

export type VisitaParaAnular = {
  estado: string;
  expedienteArchivado: boolean;
  hoja: HojaParaAnular;
};

export const MENSAJE_EXPEDIENTE_ARCHIVADO =
  "El expediente está cerrado y archivado: para modificar sus visitas, un usuario autorizado debe reabrirlo desde Administración.";

function enFirma(hoja: HojaParaAnular): boolean {
  return Boolean(hoja && (hoja.finalizadaEn || hoja.documentoConceptoId));
}

export function bloqueoCancelarVisita(v: VisitaParaAnular): string | null {
  if (v.estado === "CANCELADA") return "La visita ya está cancelada.";
  if (v.expedienteArchivado) return MENSAJE_EXPEDIENTE_ARCHIVADO;
  if (enFirma(v.hoja)) {
    return "El concepto técnico de esta visita ya se envió a firma: la visita no se puede cancelar. Si el concepto debe cambiarse, use «Reabrir para corrección».";
  }
  return null;
}

export function bloqueoEliminarVisita(v: VisitaParaAnular): string | null {
  if (v.expedienteArchivado) return MENSAJE_EXPEDIENTE_ARCHIVADO;
  if (enFirma(v.hoja)) {
    return "La visita tiene un concepto técnico que ya pasó a firmas: no se puede eliminar.";
  }
  if (v.hoja) {
    const concepto = v.hoja.conceptoNumero ? ` y el concepto técnico N.° ${v.hoja.conceptoNumero}` : "";
    return `La visita ya tiene hoja de visita registrada${concepto}: no se puede eliminar. Puede cancelarla; queda en el historial.`;
  }
  return null;
}

/** Lo que la interfaz necesita para mostrar «Cancelar» y «Eliminar» a quien puede anular visitas. */
export function opcionesAnulacion(v: VisitaParaAnular): { cancelar: boolean; eliminar: boolean; bloqueoEliminar: string | null } {
  const bloqueoEliminar = bloqueoEliminarVisita(v);
  return { cancelar: bloqueoCancelarVisita(v) === null, eliminar: bloqueoEliminar === null, bloqueoEliminar };
}
