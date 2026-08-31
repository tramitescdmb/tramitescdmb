import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  extensionPermitida,
  mensajeArchivoDemasiadoGrande,
  mensajeTipoNoPermitido,
  TAMANO_MAXIMO_BYTES,
} from "@/lib/uploads-config";

export type ArchivoSubido = {
  path: string;
  nombre: string;
  mimeType: string;
  tamanoBytes: number;
};

/**
 * Sube un archivo directo desde el navegador a Supabase Storage (sin pasar por
 * el servidor de Next.js), usando una URL de subida firmada de un solo uso.
 * Así no aplica el límite de tamaño de solicitud de Vercel (~4.5MB) — sirve
 * para los planos, estudios técnicos, etc. que piden algunos trámites.
 */
export async function subirArchivoDirecto(expedienteId: string, file: File): Promise<ArchivoSubido> {
  if (!extensionPermitida(file.name)) throw new Error(mensajeTipoNoPermitido(file.name));
  if (file.size > TAMANO_MAXIMO_BYTES) throw new Error(mensajeArchivoDemasiadoGrande(file.name));

  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expedienteId, fileName: file.name }),
  });
  if (!signRes.ok) {
    const body = await signRes.json().catch(() => ({}));
    throw new Error(body.error || `No se pudo preparar la subida de "${file.name}".`);
  }
  const { path, token } = await signRes.json();

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage.from("documentos").uploadToSignedUrl(path, token, file);
  if (error) throw new Error(`Falló la subida de "${file.name}": ${error.message}`);

  return {
    path,
    nombre: file.name,
    mimeType: file.type || "application/octet-stream",
    tamanoBytes: file.size,
  };
}
