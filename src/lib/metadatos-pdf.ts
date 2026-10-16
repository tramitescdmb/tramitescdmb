import { codigoVerificacion, PLATAFORMA_FIRMA, type TipoDocumentoCsv } from "@/lib/validar-firma";
import type { MetadatosDocumentoPdf } from "@/lib/pdf-rotulado";

const ESTAMPADO_DOCUMENTO = "Sello de firma, QR y CSV";

const ESTAMPADO_POR_TIPO: Record<TipoDocumentoCsv, string> = {
  T: ESTAMPADO_DOCUMENTO,
  G: ESTAMPADO_DOCUMENTO,
  A: ESTAMPADO_DOCUMENTO,
  C: "Rótulo con Code 128, sello de firma, QR y CSV",
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
    elementosEstampados: ESTAMPADO_POR_TIPO[datos.tipo],
    disenio: 7,
  };
}
