import { descargar, eliminar, existe, firmarSubida, subir, urlFirmada } from "@/lib/almacen";
import { CARPETA_SUBIDAS, nombreArchivo, variante } from "@/lib/carpetas-almacen";

const BUCKET = "documentos";

/**
 * Ruta de llegada de un archivo que sube el navegador: `_subidas/<identificador>/<sello>-<nombre>`.
 * Al registrar el documento se mueve a la carpeta de su módulo (ver organizar-archivos.ts).
 */
export function buildStoragePath(expedienteId: string, fileName: string) {
  return `${CARPETA_SUBIDAS}/${expedienteId}/${Date.now()}-${nombreArchivo(fileName)}`;
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Indica si una ruta de almacenamiento enviada por el navegador está en la carpeta de llegada
 * de ese expediente, tal como la arma buildStoragePath. Evita que se registre en un expediente un archivo de otro (para luego
 * leerlo o borrarlo con los permisos de este): las carpetas definitivas por módulo nunca se
 * aceptan desde el navegador.
 */
export function rutaDeExpediente(ruta: unknown, expedienteId: string): ruta is string {
  if (typeof ruta !== "string" || !expedienteId) return false;
  return new RegExp(`^${escaparRegex(CARPETA_SUBIDAS)}/${escaparRegex(expedienteId)}/[A-Za-z0-9._-]+$`).test(ruta) && ![".", ".."].includes(ruta.slice(ruta.lastIndexOf("/") + 1));
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

/** Guarda un archivo generado en el servidor sin pisar otro: "Acta.pdf", "Acta_2.pdf"… Devuelve la ruta usada. */
export async function uploadDocumentoNuevo(path: string, file: Buffer, mimeType: string): Promise<string> {
  for (let n = 1; n <= 500; n++) {
    const ruta = variante(path, n);
    try {
      await subir(BUCKET, ruta, file, mimeType);
      return ruta;
    } catch (e) {
      const yaExiste = (e as NodeJS.ErrnoException).code === "EEXIST" || /exist/i.test(e instanceof Error ? e.message : "");
      if (!yaExiste) throw e;
    }
  }
  throw new Error(`No se encontró un nombre libre para ${path}`);
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
