/**
 * Enlaces de VITAL sin ningún dependencia de servidor (Prisma/Storage/env secretos) — a diferencia de
 * `vital.ts`, este archivo se puede importar también desde un componente cliente (ej. `TablaVital.tsx`).
 */

/**
 * Enlace público de consulta de una solicitud en el propio VITAL, por su `idVital` — no exige sesión
 * (verificado en vivo: el buscador público resuelve el registro directo con este parámetro). Es la
 * única vía de VITAL que se puede enlazar de forma genérica: la ficha con adjuntos que sí muestra
 * "Acciones" (ReporteTramiteCPDetalle.aspx) exige iniciar sesión en el portal de la autoridad
 * ambiental (no el mismo login del proxy X-Road de la CDMB) y sus parámetros `TarSolId`/`Solicitante`
 * son internos de esa sesión — no se pueden derivar ni construir desde acá.
 */
export function urlVitalPublico(idVital: string): string {
  return `https://vital-publico.minambiente.gov.co/buscador?dato=${encodeURIComponent(idVital)}&prefiltro=Todos`;
}
