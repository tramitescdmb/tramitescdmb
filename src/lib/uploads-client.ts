import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  extensionPermitida,
  mensajeArchivoDemasiadoGrande,
  mensajeArchivoDemasiadoGrandeContratacion,
  mensajeTipoNoPermitido,
  TAMANO_MAXIMO_BYTES,
  TAMANO_MAXIMO_CONTRATACION_BYTES,
} from "@/lib/uploads-config";

export type ArchivoSubido = {
  path: string;
  nombre: string;
  mimeType: string;
  tamanoBytes: number;
};

export type DocumentoSubido = ArchivoSubido & { hashSha256: string | null };

export async function sha256Hex(file: File): Promise<string | null> {
  try {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

export async function subirArchivoDirecto(
  expedienteId: string,
  file: File,
  opciones?: { nuevo?: boolean }
): Promise<ArchivoSubido> {
  if (!extensionPermitida(file.name)) throw new Error(mensajeTipoNoPermitido(file.name));
  if (file.size > TAMANO_MAXIMO_BYTES) throw new Error(mensajeArchivoDemasiadoGrande(file.name));

  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expedienteId, fileName: file.name, nuevo: opciones?.nuevo === true }),
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

export async function subirDocumentosConProgreso(
  archivos: File[],
  subir: (folder: string, file: File) => Promise<ArchivoSubido>,
  folder: string,
  onProgreso: (pct: number, texto: string) => void,
  mensajeFinal = "Generando el número de radicado y guardando…"
): Promise<DocumentoSubido[]> {
  const documentos: DocumentoSubido[] = [];
  const totalUnidades = archivos.length + 1;
  for (let i = 0; i < archivos.length; i++) {
    const file = archivos[i]!;
    onProgreso(Math.round((i / totalUnidades) * 100), `Subiendo "${file.name}" (${i + 1} de ${archivos.length})…`);
    const subido = await subir(folder, file);
    const hashSha256 = await sha256Hex(file);
    documentos.push({ ...subido, hashSha256 });
  }
  onProgreso(Math.round((archivos.length / totalUnidades) * 100), mensajeFinal);
  return documentos;
}

export async function subirArchivoExpediente(expedienteId: string, file: File): Promise<ArchivoSubido> {
  if (!extensionPermitida(file.name)) throw new Error(mensajeTipoNoPermitido(file.name));
  if (file.size > TAMANO_MAXIMO_BYTES) throw new Error(mensajeArchivoDemasiadoGrande(file.name));

  const signRes = await fetch(`/api/correspondencia/expedientes/${expedienteId}/upload-sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name }),
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

export async function subirArchivoPublico(folder: string, file: File): Promise<ArchivoSubido> {
  if (!extensionPermitida(file.name)) throw new Error(mensajeTipoNoPermitido(file.name));
  if (file.size > TAMANO_MAXIMO_BYTES) throw new Error(mensajeArchivoDemasiadoGrande(file.name));

  const signRes = await fetch("/api/pqrsd/upload-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder, fileName: file.name }),
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

export async function subirArchivoContrato(expedienteId: string, file: File): Promise<ArchivoSubido> {
  if (!extensionPermitida(file.name)) throw new Error(mensajeTipoNoPermitido(file.name));
  if (file.size > TAMANO_MAXIMO_CONTRATACION_BYTES) throw new Error(mensajeArchivoDemasiadoGrandeContratacion(file.name));

  const signRes = await fetch(`/api/contratacion/expedientes/${expedienteId}/upload-sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name }),
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
