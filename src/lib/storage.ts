import { descargar, eliminar, firmarSubida, subir, urlFirmada } from "@/lib/almacen";

const BUCKET = "documentos";

export function buildStoragePath(expedienteId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `expedientes/${expedienteId}/${Date.now()}-${safeName}`;
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Indica si una ruta de almacenamiento enviada por el navegador pertenece a la carpeta
 * de ese expediente, tal como la arma buildStoragePath. Evita que se registre en un
 * expediente un archivo de otro (para luego leerlo o borrarlo con los permisos de este).
 */
export function rutaDeExpediente(ruta: unknown, expedienteId: string): ruta is string {
  if (typeof ruta !== "string" || !expedienteId) return false;
  return new RegExp(`^expedientes/${escaparRegex(expedienteId)}/[A-Za-z0-9._-]+$`).test(ruta) && ![".", ".."].includes(ruta.slice(ruta.lastIndexOf("/") + 1));
}

export const MENSAJE_RUTA_AJENA = "El archivo no corresponde a este expediente. Vuelva a subirlo.";

export async function uploadDocumento(path: string, file: Buffer, mimeType: string) {
  await subir(BUCKET, path, file, mimeType);
  return path;
}

export async function crearUrlSubidaFirmada(path: string) {
  return firmarSubida(BUCKET, path);
}

export async function getSignedDownloadUrl(path: string, expiresInSeconds = 300) {
  return urlFirmada(BUCKET, path, expiresInSeconds);
}

export async function deleteDocumento(path: string) {
  await eliminar(BUCKET, [path]);
}

export async function descargarDocumento(path: string): Promise<Buffer> {
  return descargar(BUCKET, path);
}
