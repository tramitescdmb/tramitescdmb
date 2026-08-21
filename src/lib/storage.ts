import { createClient } from "@supabase/supabase-js";

const BUCKET = "documentos";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase no está configurado (faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function buildStoragePath(expedienteId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `expedientes/${expedienteId}/${Date.now()}-${safeName}`;
}

export async function uploadDocumento(path: string, file: Buffer, mimeType: string) {
  const supabase = getAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/**
 * Genera una URL de subida firmada de un solo uso: el navegador sube el archivo
 * directo a Supabase Storage con esto, sin pasar el archivo por el servidor de
 * Next.js/Vercel (que tiene un límite de tamaño de solicitud mucho más chico).
 */
export async function crearUrlSubidaFirmada(path: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { path: data.path, token: data.token };
}

export async function getSignedDownloadUrl(path: string, expiresInSeconds = 300) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDocumento(path: string) {
  const supabase = getAdminClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
