/**
 * Sigla de expediente por tipo de trámite. Son las mismas siglas que usa SINCA («(CA) CONCESIONES
 * DE AGUAS», expediente CA-0125-2006); para los trámites que SINCA no tenía se fijaron siglas nuevas,
 * aprobadas por la Subdirección el 19-nov-2026. Los trámites que comparten sigla comparten serie.
 *
 * La sigla guardada en TramiteTipo.sigla (editable en /admin/consecutivos) tiene prioridad sobre esta
 * tabla. Un trámite sin sigla conserva el número anterior (código del procedimiento-año-consecutivo).
 */
export const SIGLA_POR_PROCEDIMIENTO: Record<string, string> = {
  "M-DA-PR21": "CA", // Concesión de aguas superficiales y subterráneas
  "M-DA-PR66": "CA", // Concesión de agua residual tratada
  "M-DA-PR41": "AF", // Aprovechamiento forestal (el procedimiento dice «nomenclatura AF»)
  "M-DA-PR48": "AF", // Poda, traslado, tala y corte de árboles
  "M-DA-PR33": "PE", // Prospección y exploración de aguas subterráneas
  "M-DA-PR05": "VE", // Permiso de vertimientos
  "M-DA-PR39": "OC", // Ocupación de cauces, playas y lechos
  "M-DA-PR63": "AG", // Generadores de aceites de cocina usados
  "M-DA-PR62": "AR", // Gestores (recolectores) de aceites de cocina usados
  "M-DA-PR22": "LA", // Licencia ambiental global
  "M-DA-PR65": "LA", // Licencia ambiental temporal (formalización minera)
  "M-DA-PR45": "TH", // Plan de contingencia para el transporte de hidrocarburos
  "M-DA-PR07": "EA", // Emisiones atmosféricas
  "M-DA-PR09": "CD", // Centros de diagnóstico automotor
  "M-DA-PR36": "SV", // Plan de saneamiento y manejo de vertimientos (PSMV)
  "M-DA-PR34": "PC", // Recolección de especímenes, investigación científica
  "SUIT-21916": "PC", // Permiso de estudio, recolección de especímenes
  "M-DA-PR42": "CI", // Certificación de inversiones ambientales
  "M-DA-PR16": "SU", // Salvoconducto único nacional en línea
  "M-DA-PR58": "SU", // Salvoconducto, removilización
  "M-DA-PR59": "SU", // Salvoconducto, renovación
  "M-DA-PR29": "DG", // Departamento de gestión ambiental
  "M-DA-PR35": "PB", // Inventario de PCB
  "M-DA-PR43": "RP", // Registro de generadores de residuos peligrosos
  "M-DA-PR55": "AN", // Proyectos a licenciar por la ANLA
  "M-DA-PR60": "RC", // Manejo y disposición de RCD
  "M-DA-PR64": "DV", // Certificación para la desintegración vehicular
  "M-DA-PR67": "RH", // Registro de usuarios del recurso hídrico (RURH)
  "M-DA-PR69": "LF", // Libro de operaciones forestales en línea
  "M-DA-PR70": "RF", // Registro de plantaciones forestales
  "M-DA-PR71": "CZ", // Permiso de caza de fauna silvestre
  "SUIT-19294": "EX", // Exportación o importación de productos forestales y flora
};

/** Dos a cuatro letras mayúsculas. */
export const FORMATO_SIGLA = /^[A-Z]{2,4}$/;

export function normalizarSigla(texto: string | null | undefined): string | null {
  const s = (texto ?? "").trim().toUpperCase();
  return FORMATO_SIGLA.test(s) ? s : null;
}

export function siglaDeTramite(t: { codigo: string; sigla?: string | null }): string | null {
  return normalizarSigla(t.sigla) ?? SIGLA_POR_PROCEDIMIENTO[t.codigo] ?? null;
}

/** Serie del consecutivo de una sigla (compartida por todos los trámites con esa sigla). */
export function serieSigla(sigla: string): string {
  return `TRAMITE-SIGLA-${sigla}`;
}

/** Número de expediente con sigla, igual que SINCA: CA-0082-2026. */
export function formatearNumeroSigla(sigla: string, anio: number, numero: number): string {
  return `${sigla}-${String(numero).padStart(4, "0")}-${anio}`;
}
