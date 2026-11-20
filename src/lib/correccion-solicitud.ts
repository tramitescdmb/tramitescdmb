/**
 * Devolución de una solicitud en línea para corrección (art. 17 CPACA): reglas puras.
 * La CDMB marca los documentos que están mal o faltan; el ciudadano los reemplaza en el mismo
 * expediente desde «Mis solicitudes». Vencido el plazo no se hace nada automático.
 */

/** Plazo legal por defecto: un mes calendario (art. 17 CPACA). La CDMB puede fijar otro. */
export const PLAZO_MAXIMO_DIAS = 92;
export const MAX_ITEMS_CORRECCION = 40;

export function plazoPorDefecto(desde: Date): string {
  const d = new Date(desde.getTime());
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/** «AAAA-MM-DD» → fin de ese día en Colombia (UTC-5), validando que sea futuro y dentro del máximo. */
export function interpretarPlazo(texto: unknown, ahora: Date): Date | null {
  if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const fin = new Date(`${texto}T23:59:59.000-05:00`);
  if (Number.isNaN(fin.getTime())) return null;
  if (fin.getTime() <= ahora.getTime()) return null;
  if (fin.getTime() - ahora.getTime() > PLAZO_MAXIMO_DIAS * 86_400_000) return null;
  return fin;
}

export type ItemEntrada = { documentoId?: unknown; requisitoId?: unknown; titulo?: unknown; motivo?: unknown };
export type ItemValido = { documentoId: string | null; requisitoId: string | null; titulo: string | null; motivo: string };

/** Cada ítem: un documento a reemplazar o un faltante (requisito o título libre), siempre con motivo. */
export function validarItems(entrada: unknown): { ok: true; items: ItemValido[] } | { ok: false; error: string } {
  if (!Array.isArray(entrada) || entrada.length === 0) return { ok: false, error: "Marque al menos un documento para corregir o agregue uno faltante." };
  if (entrada.length > MAX_ITEMS_CORRECCION) return { ok: false, error: `Como máximo ${MAX_ITEMS_CORRECCION} documentos por devolución.` };
  const items: ItemValido[] = [];
  const vistos = new Set<string>();
  for (const bruto of entrada as ItemEntrada[]) {
    const documentoId = typeof bruto?.documentoId === "string" && bruto.documentoId ? bruto.documentoId : null;
    const requisitoId = !documentoId && typeof bruto?.requisitoId === "string" && bruto.requisitoId ? bruto.requisitoId : null;
    const titulo = typeof bruto?.titulo === "string" ? bruto.titulo.trim().slice(0, 200) : "";
    const motivo = typeof bruto?.motivo === "string" ? bruto.motivo.trim().slice(0, 2000) : "";
    if (!documentoId && !requisitoId && !titulo) return { ok: false, error: "Indique el nombre del documento faltante." };
    if (motivo.length < 5) return { ok: false, error: "Explique al solicitante, en cada documento, qué debe corregir o aportar." };
    const clave = documentoId ? `d:${documentoId}` : requisitoId ? `r:${requisitoId}` : `t:${titulo.toLowerCase()}`;
    if (vistos.has(clave)) return { ok: false, error: "Un documento aparece dos veces en la devolución." };
    vistos.add(clave);
    items.push({ documentoId, requisitoId, titulo: titulo || null, motivo });
  }
  return { ok: true, items };
}

/** Estado al que vuelve el expediente cuando el ciudadano responde. */
export function estadoTrasRespuesta(estadoAnterior: string): "RADICADO" | "EN_TRAMITE" {
  return estadoAnterior === "RADICADO" ? "RADICADO" : "EN_TRAMITE";
}
