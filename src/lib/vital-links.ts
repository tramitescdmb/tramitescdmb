export function urlVitalPublico(idVital: string): string {
  return `https://vital-publico.minambiente.gov.co/buscador?dato=${encodeURIComponent(idVital)}&prefiltro=Todos`;
}

/**
 * Igual que SINCA: VITAL entrega la url del archivo y se pide por el puente con
 * POST /descargar, poniendo esa url (con `_t=<marca de tiempo>` para que nadie en
 * el camino devuelva una respuesta guardada) en la cabecera X-Road-Url.
 */
export function urlDescargaVital(urlArchivo: string, ahora = Date.now()): string {
  return `${urlArchivo}${urlArchivo.includes("?") ? "&" : "?"}_t=${ahora}`;
}

/**
 * Conteo de anexos de una solicitud: los guardados en el NAS y los que VITAL
 * reporta pero aún no se han traído (la descarga falló al sincronizar).
 */
export function conteoDocsVital(guardados: number, reportados: number | null | undefined): { total: number; enVital: number } {
  const total = Math.max(guardados, reportados ?? 0);
  return { total, enVital: total - guardados };
}
