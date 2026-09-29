"use client";

function limpiarRuta(path: string) {
  return path.replace(/^\/|\/$/g, "").replace(/\/+/g, "/");
}

export async function subirAUrlFirmada(bucket: string, path: string, token: string, file: Blob): Promise<{ error: { message: string } | null }> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anonKey) {
    throw new Error("Falta configurar NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  const url = new URL(`${base}/storage/v1/object/upload/sign/${bucket}/${limpiarRuta(path)}`);
  url.searchParams.set("token", token);
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  try {
    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "x-upsert": "false" },
      body,
    });
    if (res.ok) return { error: null };
    const datos = await res.json().catch(() => ({}));
    return { error: { message: datos.message || datos.error || `HTTP ${res.status}` } };
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : "Error de red" } };
  }
}
