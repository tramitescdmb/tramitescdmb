import { TAMANO_MAXIMO_CONTRATACION_BYTES } from "@/lib/uploads-config";
import { TAMANO_MAXIMO_FOTO_VISITA_MB } from "@/lib/visita-tecnica-fotos";

async function comprimirImagen(file: File, maxSizeMB: number): Promise<File> {
  const mod = await import("browser-image-compression");
  const imageCompression = mod.default;
  try {
    const comprimido = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight: 2500,
      useWebWorker: true,
      initialQuality: 0.8,
    });
    return new File([comprimido], file.name, { type: comprimido.type || file.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}

export async function comprimirFotoVisitaTecnica(file: File): Promise<File> {
  // 1.8 en vez de 2.0: deja margen para que el resultado real quede bajo el límite duro.
  return comprimirImagen(file, TAMANO_MAXIMO_FOTO_VISITA_MB - 0.2);
}

async function intentarComprimirPdf(file: File): Promise<File> {
  try {
    const bytes = await file.arrayBuffer();
    const { PDFDocument } = await import("pdf-lib");
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
  if (file.type.startsWith("image/")) return comprimirImagen(file, 1.8);
  if (file.type === "application/pdf") return intentarComprimirPdf(file);
  return file;
}
