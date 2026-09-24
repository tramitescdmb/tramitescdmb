import { PDFDocument } from "pdf-lib";
import { TAMANO_MAXIMO_CONTRATACION_BYTES } from "@/lib/uploads-config";

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
    return new File([comprimido], file.name, { type: comprimido.type || file.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}

async function intentarComprimirPdf(file: File): Promise<File> {
  try {
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const recomprimido = await doc.save({ useObjectStreams: true });
    if (recomprimido.byteLength >= file.size) return file;
    return new File([recomprimido as unknown as BlobPart], file.name, { type: "application/pdf", lastModified: Date.now() });
  } catch {
    return file;
  }
}

export async function comprimirParaContratacion(file: File): Promise<File> {
  if (file.size <= TAMANO_MAXIMO_CONTRATACION_BYTES) return file;
  if (file.type.startsWith("image/")) return comprimirImagen(file);
  if (file.type === "application/pdf") return intentarComprimirPdf(file);
  return file;
}
