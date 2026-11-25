export type DocumentoVital = { nombre_archivo: string; url_archivo: string };

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

/**
 * Normaliza la respuesta de wsDocumentos. Se aceptan los nombres de campo conocidos
 * (nombre_archivo / nombreArchivo…, url_archivo / urlArchivo…) y TODAS las listas
 * que traiga la respuesta. Un anexo sin dirección de descarga también se conserva
 * (antes se descartaba y la ficha mostraba menos anexos que VITAL).
 */
export function normalizarDocumentosVital(data: unknown): DocumentoVital[] {
  const filas: Record<string, unknown>[] = [];
  const recoger = (v: unknown, prof = 0) => {
    if (prof > 3 || v == null) return;
    if (Array.isArray(v)) {
      for (const x of v) {
        if (x && typeof x === "object" && !Array.isArray(x)) filas.push(x as Record<string, unknown>);
      }
      return;
    }
    if (typeof v === "object") for (const x of Object.values(v as Record<string, unknown>)) recoger(x, prof + 1);
  };
  recoger(data);

  const vistos = new Set<string>();
  const docs: DocumentoVital[] = [];
  for (const f of filas) {
    const url = texto(f.url_archivo ?? f.urlArchivo ?? f.UrlArchivo ?? f.url ?? f.ruta ?? f.rutaArchivo);
    let nombre = texto(f.nombre_archivo ?? f.nombreArchivo ?? f.NombreArchivo ?? f.nombre ?? f.nombreDocumento);
    if (!nombre && url) nombre = decodeURIComponent(url.split("?")[0].split(/[\\/]/).pop() ?? "");
    if (!nombre) continue;
    const clave = `${nombre}|${url}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    docs.push({ nombre_archivo: nombre, url_archivo: url });
  }
  return docs;
}

