"use client";

function limpiarRuta(path: string) {
  return path.replace(/^\/|\/$/g, "").replace(/\/+/g, "/");
}

/** Sube un archivo al NAS con el token firmado que entrega el servidor. */
export async function subirAUrlFirmada(bucket: string, path: string, token: string, file: Blob): Promise<{ error: { message: string } | null }> {
  const ruta = limpiarRuta(path).split("/").map(encodeURIComponent).join("/");
  const body = new FormData();
  body.append("archivo", file);
  try {
    const res = await fetch(`/api/almacen/${bucket}/${ruta}?token=${encodeURIComponent(token)}`, { method: "PUT", body });
    if (res.ok) return { error: null };
    const datos = await res.json().catch(() => ({}));
    return { error: { message: datos.message || datos.error || `HTTP ${res.status}` } };
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : "Error de red" } };
  }
}
