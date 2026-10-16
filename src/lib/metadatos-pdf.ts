import { codigoVerificacion, PLATAFORMA_FIRMA, type TipoDocumentoCsv } from "@/lib/validar-firma";
import type { MetadatosDocumentoPdf } from "@/lib/pdf-rotulado";

const HUELLA_FIRMA_DOCUMENTO = "SHA-256 sobre el identificador del documento, su nombre, la huella del archivo y la fecha y hora de la firma";
const ESTAMPADO_DOCUMENTO = "sello de firma, código QR, código seguro de verificación (CSV) en el margen de cada página y esta diligencia";

const HUELLA_FIRMA_POR_TIPO: Record<TipoDocumentoCsv, string> = {
  T: HUELLA_FIRMA_DOCUMENTO,
  G: HUELLA_FIRMA_DOCUMENTO,
  A: HUELLA_FIRMA_DOCUMENTO,
  C: "SHA-256 sobre el radicado, el asunto, el contenido, las huellas de los adjuntos y la fecha y hora de la firma",
};

const ESTAMPADO_POR_TIPO: Record<TipoDocumentoCsv, string> = {
  T: ESTAMPADO_DOCUMENTO,
  G: ESTAMPADO_DOCUMENTO,
  A: ESTAMPADO_DOCUMENTO,
  C: `rótulo de radicación con código de barras Code 128, ${ESTAMPADO_DOCUMENTO}`,
};

const PLATAFORMA_POR_TIPO: Record<TipoDocumentoCsv, string> = {
  T: PLATAFORMA_FIRMA.tramites,
  G: PLATAFORMA_FIRMA.gecon,
  A: PLATAFORMA_FIRMA.sgdea,
  C: PLATAFORMA_FIRMA.sgdea,
};

export function metadatosPdf(datos: {
  tipo: TipoDocumentoCsv;
  id: string;
  baseUrl: string;
  documento: string;
  referencia: string;
  hashArchivo: string | null;
}): MetadatosDocumentoPdf {
  const csv = codigoVerificacion(datos.tipo, datos.id);
  const urlBaseValidador = `${datos.baseUrl.replace(/\/+$/, "")}/validar-firma`;
  return {
    csv,
    urlValidacion: `${urlBaseValidador}?csv=${encodeURIComponent(csv)}`,
    urlBaseValidador,
    documento: datos.documento,
    plataforma: PLATAFORMA_POR_TIPO[datos.tipo],
    referencia: datos.referencia,
    hashArchivo: datos.hashArchivo,
    metodoHuellaFirma: HUELLA_FIRMA_POR_TIPO[datos.tipo],
    elementosEstampados: ESTAMPADO_POR_TIPO[datos.tipo],
    disenio: 5,
  };
}
