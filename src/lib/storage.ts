import { descargar, eliminar, existe, firmarSubida, subir, urlFirmada } from "@/lib/almacen";

const BUCKET = "documentos";

export function buildStoragePath(expedienteId: string, fileName: string) {
  let safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Un nombre muy largo supera el límite del sistema de archivos (255 bytes) y la subida fallaba con error 500:
  // se recorta conservando la extensión.
  if (safeName.length > 120) {
    const punto = safeName.lastIndexOf(".");
    const ext = punto > 0 && safeName.length - punto <= 11 ? safeName.slice(punto) : "";
    safeName = safeName.slice(0, 120 - ext.length) + ext;
  }
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

/**
 * Antes de registrar un archivo subido: que exista en el almacenamiento (la subida pudo fallar) y que
 * ningún otro documento lo use ya (un doble envío lo registraría dos veces y, al borrar uno, el otro
 * quedaría sin archivo). Devuelve el mensaje de error o null.
 */
export async function problemaArchivoSubido(ruta: string, usosExistentes: number): Promise<string | null> {
  if (usosExistentes > 0) return "Este archivo ya está registrado en otro documento. Si fue un doble clic, recargue la página.";
  if (!(await existe(BUCKET, ruta))) return "El archivo no terminó de subirse. Vuelva a subirlo.";
  return null;
}

export async function uploadDocumento(path: string, file: Buffer, mimeType: string) {
  await subir(BUCKET, path, file, mimeType);
  return path;
}

export async function crearUrlSubidaFirmada(path: string, topeMb?: number) {
  return firmarSubida(BUCKET, path, topeMb);
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
