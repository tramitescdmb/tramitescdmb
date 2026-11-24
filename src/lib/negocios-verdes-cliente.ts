/** Llamada JSON del panel de Negocios Verdes: devuelve el cuerpo o lanza el mensaje de error del servidor. */
export async function llamarNV<T = Record<string, unknown>>(url: string, metodo: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: metodo,
    headers: cuerpo instanceof FormData || cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: cuerpo instanceof FormData ? cuerpo : cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || "No se pudo completar la acción.");
  return j as T;
}
