/**
 * Trámites donde tiene sentido pedir datos estructurados del predio (nombre, número catastral,
 * matrícula inmobiliaria, áreas, número de viviendas) — NO todos los 30 trámites, solo aquellos
 * donde el predio específico es el objeto de un derecho u obligación continua sobre esa tierra
 * (concesiones de agua, aprovechamiento/registro forestal, RCD, RURH) y el procedimiento oficial
 * efectivamente pide acreditar la tenencia del predio (Certificado de Libertad y Tradición o
 * equivalente) y/o localización del predio como documento obligatorio.
 *
 * Revisado uno por uno contra `data/tramites/*.json` (2026-08-23) — no es un chequeo de la palabra
 * "predio" a secas, porque varios trámites la mencionan por otra razón (ej. "matrícula profesional"
 * en PR34/PR35 no tiene nada que ver con predios). Deliberadamente EXCLUIDOS aunque sí piden algún
 * documento de tenencia del predio:
 * - PR39 (Ocupación de Cauces): el objeto del permiso es la obra sobre un bien de uso público
 *   (cauce/lecho), el predio es solo para acreditar quién tiene el derecho a solicitar — no hay un
 *   área/uso continuo del predio que valga la pena capturar en campos separados.
 * - PR48 (Poda/Tala de árboles): permiso puntual sobre uno o pocos árboles, casi siempre en área
 *   pública o un predio muy pequeño — catastral/matrícula/áreas/viviendas no aportan nada aquí.
 * - PR22 (Licencia Ambiental Global) y PR65 (Licencia Ambiental Temporal minera): proyectos grandes
 *   que ya exigen Estudio de Impacto Ambiental con planos en Geodatabase georreferenciada — mucho
 *   más preciso que estos 6 campos básicos, sería redundante.
 *
 * Si se agrega un trámite nuevo o cambia el procedimiento de alguno de estos, revisar de nuevo aquí.
 */
export const TRAMITES_CON_DATOS_PREDIO = new Set([
  "M-DA-PR05", // Permiso de Vertimientos — pide nombre y localización del predio (obligatorio)
  "M-DA-PR21", // Concesión de Aguas Superficiales/Subterránea — origen de estos campos (formulario legado)
  "M-DA-PR33", // Prospección y Exploración de Aguas Subterráneas — ubicación y extensión del predio
  "M-DA-PR41", // Aprovechamiento Forestal — mapa del predio con áreas de aprovechamiento
  "M-DA-PR60", // Manejo y Disposición de RCD — nombre y localización del predio (obligatorio)
  "M-DA-PR66", // Concesión de Agua Residual Tratada — nombre o localización del predio (obligatorio)
  "M-DA-PR67", // Registro de Usuarios del Recurso Hídrico (RURH) — usuarios rurales, nro. de viviendas aplica directo
  "M-DA-PR69", // Libro de Operaciones Forestales en Línea — inventario de productos en el predio
  "M-DA-PR70", // Registro de Plantaciones Forestales — georreferenciación del área de plantación
]);

export function aplicaDatosPredio(codigoTramite: string): boolean {
  return TRAMITES_CON_DATOS_PREDIO.has(codigoTramite);
}
