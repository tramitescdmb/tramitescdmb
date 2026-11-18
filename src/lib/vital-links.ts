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
