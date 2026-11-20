// Describe a qué registro pertenece un documento firmado: expediente, trámite, etapa y tipo de
// documento. Lo usan la ficha técnica de firmas, el validador público y la hoja de diligencia del
// PDF para que la firma nunca quede ligada solo al nombre del archivo (que el usuario puede llamar
// como quiera). No lee ni modifica firmas: solo arma textos a partir de datos del documento.

export type DetalleRegistro = { etiqueta: string; valor: string };

export type DocumentoTramiteParaRegistro = {
  pasoNumero: number | null;
  requisito?: { nombre: string } | null;
  tipoDocumental?: { nombre: string } | null;
  expediente: {
    numero: string;
    tramiteTipo: { nombre: string };
    flujo?: { nombre: string; pasos: { numero: number; titulo: string }[] } | null;
  };
};

/** Etapa del trámite en la que se cargó el documento. */
export function etapaDocumentoTramite(doc: DocumentoTramiteParaRegistro): string | null {
  if (doc.pasoNumero != null) {
    const paso = doc.expediente.flujo?.pasos.find((p) => p.numero === doc.pasoNumero);
    return paso ? `Paso ${paso.numero} · ${paso.titulo}` : `Paso ${doc.pasoNumero}`;
  }
  if (doc.requisito) return "Radicación (documento requerido)";
  return null;
}

/** Tipo de documento: el requisito de radicación o, si no hay, el tipo documental de la TRD. */
export function tipoDocumentoTramite(doc: DocumentoTramiteParaRegistro): string | null {
  return doc.requisito?.nombre ?? doc.tipoDocumental?.nombre ?? null;
}

/**
 * Datos del registro al que pertenece un documento de Trámites. Todos son datos del trámite, no del
 * solicitante, así que se pueden mostrar en el validador público sin exponer datos personales.
 */
export function registroDocumentoTramite(doc: DocumentoTramiteParaRegistro): DetalleRegistro[] {
  const etapa = etapaDocumentoTramite(doc);
  const tipo = tipoDocumentoTramite(doc);
  return [
    { etiqueta: "Expediente", valor: doc.expediente.numero },
    { etiqueta: "Trámite", valor: doc.expediente.tramiteTipo.nombre },
    ...(doc.expediente.flujo?.nombre ? [{ etiqueta: "Procedimiento", valor: doc.expediente.flujo.nombre }] : []),
    ...(etapa ? [{ etiqueta: "Etapa del trámite", valor: etapa }] : []),
    ...(tipo ? [{ etiqueta: "Tipo de documento", valor: tipo }] : []),
  ];
}

/** Selección de Prisma para armar el registro de un ExpedienteDocumento. */
export const SELECT_REGISTRO_TRAMITE = {
  pasoNumero: true,
  requisito: { select: { nombre: true } },
  tipoDocumental: { select: { nombre: true } },
  expediente: {
    select: {
      numero: true,
      tramiteTipo: { select: { nombre: true } },
      flujo: { select: { nombre: true, pasos: { select: { numero: true, titulo: true } } } },
    },
  },
} as const;
