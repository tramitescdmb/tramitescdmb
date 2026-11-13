import { descargar, eliminar, firmarSubida, subir, urlFirmada } from "@/lib/almacen";

const BUCKET = "documentos";

export function buildStoragePath(expedienteId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `expedientes/${expedienteId}/${Date.now()}-${safeName}`;
}

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
