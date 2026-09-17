import { PDFDocument } from "pdf-lib";
import { TAMANO_MAXIMO_CONTRATACION_BYTES } from "@/lib/uploads-config";

/**
 * Compresión del lado del cliente para el módulo de Contratación (tope 2MB por
 * archivo). Límite honesto, documentado para no prometer de más:
 * - Una IMAGEN sí se puede recomprimir de verdad en el navegador
 *   (`browser-image-compression`, reduce calidad/resolución con pérdida
 *   controlada).
 * - Un PDF NO se puede recomprimir de verdad en este stack: no hay Ghostscript
 *   ni un motor de rasterizado en Vercel serverless ni en el navegador. El
 *   intento con `pdf-lib` solo reguarda el documento con streams comprimidos
 *   (baja algo de peso si el PDF original no estaba optimizado), pero NO baja
 *   la resolución de imágenes incrustadas — la mayoría de PDFs pesados
 *   (escaneos) no bajarán lo suficiente. Si sigue por encima del tope tras el
 *   intento, se debe rechazar y pedirle al usuario que lo reduzca antes de
 *   subirlo (mismo criterio de "honestidad de alcance" ya aplicado al PDF/A
 *   del SGDEA).
 */

async function comprimirImagen(file: File): Promise<File> {
  const mod = await import("browser-image-compression");
  const imageCompression = mod.default;
  try {
    const comprimido = await imageCompression(file, {
      maxSizeMB: 1.8,
      maxWidthOrHeight: 2500,
      useWebWorker: true,
      initialQuality: 0.8,
    });
    // browser-image-compression a veces devuelve un Blob sin el nombre — se reconstruye como File.
    return new File([comprimido], file.name, { type: comprimido.type || file.type, lastModified: Date.now() });
  } catch {
    return file; // si la compresión falla por cualquier motivo, se sigue con el original (se validará el tamaño igual)
  }
}

async function intentarComprimirPdf(file: File): Promise<File> {
  try {
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const recomprimido = await doc.save({ useObjectStreams: true });
    if (recomprimido.byteLength >= file.size) return file; // no mejoró, mantener el original
    // Cast: pdf-lib tipa el resultado como Uint8Array<ArrayBufferLike>, más laxo que el
    // ArrayBuffer que exige BlobPart en lib.dom — inofensivo en tiempo de ejecución.
    return new File([recomprimido as unknown as BlobPart], file.name, { type: "application/pdf", lastModified: Date.now() });
  } catch {
    return file; // PDF cifrado/corrupto/no soportado por pdf-lib: se sigue con el original
  }
}

/**
 * Intenta comprimir un archivo antes de subirlo (imagen: compresión real;
 * PDF: best-effort, ver nota arriba; cualquier otro tipo: se devuelve tal
 * cual). NO garantiza que el resultado quede bajo el tope — el llamador debe
 * seguir validando `file.size` después de esto.
 */
export async function comprimirParaContratacion(file: File): Promise<File> {
  if (file.size <= TAMANO_MAXIMO_CONTRATACION_BYTES) return file;
  if (file.type.startsWith("image/")) return comprimirImagen(file);
  if (file.type === "application/pdf") return intentarComprimirPdf(file);
  return file;
}
