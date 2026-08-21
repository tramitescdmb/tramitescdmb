import { createClient } from "@supabase/supabase-js";

const BUCKET = "branding";

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

export function buildBrandingPath(campo: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${campo}/${Date.now()}-${safeName}`;
}

/** Bucket público (a diferencia de "documentos") — el logo debe verse hasta en /login, sin sesión. */
export async function crearUrlSubidaFirmadaBranding(path: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { path: data.path, token: data.token };
}

export function getBrandingPublicUrl(path: string) {
  const supabase = getAdminClient();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteBranding(path: string) {
  const supabase = getAdminClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
