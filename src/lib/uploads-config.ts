export const EXTENSIONES_PERMITIDAS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "doc",
  "docx",
  "xls",
  "xlsx",
] as const;

export const ACCEPT_DOCUMENTOS = EXTENSIONES_PERMITIDAS.map((ext) => `.${ext}`).join(",");

export const TAMANO_MAXIMO_BYTES = 25 * 1024 * 1024;

export const TAMANO_MAXIMO_CONTRATACION_BYTES = 2 * 1024 * 1024;

export function mensajeArchivoDemasiadoGrandeContratacion(fileName: string): string {
  return `"${fileName}" pesa más de 2 MB, el máximo permitido en Contratación. Reduzca su tamaño (comprima el PDF o baje la resolución de la imagen) antes de subirlo.`;
}

export function extensionDe(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx + 1).toLowerCase();
}

export function extensionPermitida(fileName: string): boolean {
  return (EXTENSIONES_PERMITIDAS as readonly string[]).includes(extensionDe(fileName));
}

export function mensajeTipoNoPermitido(fileName: string): string {
  return `"${fileName}" no es un tipo de archivo permitido. Se aceptan: ${EXTENSIONES_PERMITIDAS.join(", ")}.`;
}

export function mensajeArchivoDemasiadoGrande(fileName: string): string {
  return `"${fileName}" pesa más de ${TAMANO_MAXIMO_BYTES / (1024 * 1024)} MB, el máximo permitido por archivo.`;
}

export function extensionPermitidaEn(fileName: string, lista: readonly string[]): boolean {
  const efectiva = lista.length > 0 ? lista : EXTENSIONES_PERMITIDAS;
  return efectiva.includes(extensionDe(fileName));
}

export function mensajeTipoNoPermitidoEn(fileName: string, lista: readonly string[]): string {
  const efectiva = lista.length > 0 ? lista : EXTENSIONES_PERMITIDAS;
  return `"${fileName}" no es un tipo de archivo permitido. Se aceptan: ${efectiva.join(", ")}.`;
}

const EXTENSION_POR_MIME_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export function conExtension(nombre: string, mimeType: string): string {
  if (extensionPermitida(nombre)) return nombre;
  const ext = EXTENSION_POR_MIME_TYPE[mimeType];
  return ext ? `${nombre}.${ext}` : nombre;
}
