/**
 * Enlaces de VITAL sin ningún dependencia de servidor (Prisma/Storage/env secretos) — a diferencia de
 * `vital.ts`, este archivo se puede importar también desde un componente cliente (ej. `TablaVital.tsx`).
 */

/**
 * Enlace público de consulta de una solicitud en el propio VITAL, por su `idVital` — no exige sesión
 * (verificado en vivo: el buscador público resuelve el registro directo con este parámetro).
 *
 * Es la única vía de VITAL enlazable de forma genérica desde `idVital` solo. Existe una ficha mejor
 * (ReportetramiteCPDetalle.aspx, portal de la autoridad ambiental) que SÍ muestra los adjuntos y —
 * corregido tras verificarlo en vivo — TAMPOCO exige sesión. Pero exige 2 ids internos de SILPA que
 * VITAL no expone ni por `wsSolicitante` (X-Road) ni por este buscador público:
 *   - `TarSolId` ("Número de trámite") SÍ se puede sacar de este buscador público.
 *   - `Solicitante` NO aparece en ningún lado accesible sin sesión propia del portal — probado que
 *     es obligatorio (sin él, la pestaña "Solicitud" con los documentos ni siquiera aparece).
 * Por eso ese enlace se guarda a mano por solicitud (`SolicitudVital.enlaceDocumentosSilpa`) en vez
 * de construirse acá. Ver [[reference_vital_sinca1]].
 */
export function urlVitalPublico(idVital: string): string {
  return `https://vital-publico.minambiente.gov.co/buscador?dato=${encodeURIComponent(idVital)}&prefiltro=Todos`;
}
