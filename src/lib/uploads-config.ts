/**
 * Reglas para los documentos que se suben a un expediente (cédulas, certificados, planos, estudios
 * técnicos...). Se valida en dos lados a propósito: en el navegador (src/lib/uploads-client.ts), para
 * avisarle al usuario antes de esperar una subida que de todas formas va a fallar; y en el servidor
 * (src/app/api/uploads/sign/route.ts), porque la validación del navegador se puede saltar. Un archivo
 * también podría rechazarse ya en Supabase Storage si el bucket "documentos" tiene su propio
 * `file_size_limit`/`allowed_mime_types` configurado — eso es un límite adicional, no reemplaza este.
 */

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

export const TAMANO_MAXIMO_BYTES = 25 * 1024 * 1024; // 25 MB

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

/**
 * Igual que extensionPermitida()/mensajeTipoNoPermitido(), pero contra la lista
 * configurable desde Administración → Seguridad (MoReq 3.1) en vez de la fija
 * de arriba. Solo se usa en el servidor (las rutas de firma de subida) — el
 * <input accept> del navegador sigue mostrando la lista de fábrica como pista;
 * el servidor es quien de verdad decide, así que un cambio de configuración
 * queda aplicado igual aunque el `accept` del formulario no se haya refrescado.
 */
export function extensionPermitidaEn(fileName: string, lista: readonly string[]): boolean {
  const efectiva = lista.length > 0 ? lista : EXTENSIONES_PERMITIDAS;
  return efectiva.includes(extensionDe(fileName));
}

export function mensajeTipoNoPermitidoEn(fileName: string, lista: readonly string[]): string {
  const efectiva = lista.length > 0 ? lista : EXTENSIONES_PERMITIDAS;
  return `"${fileName}" no es un tipo de archivo permitido. Se aceptan: ${efectiva.join(", ")}.`;
}
