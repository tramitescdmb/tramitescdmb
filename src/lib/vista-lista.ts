/** Tamaños de página fijos para listados que pueden crecer mucho (VITAL, SINCA 1.0). */
export const OPCIONES_VISTA = ["50", "100", "150", "200", "todos"] as const;
export type OpcionVista = (typeof OPCIONES_VISTA)[number];
export const VISTA_DEFECTO: OpcionVista = "50";

/** Tope real de filas cuando se pide "todos" — protección contra listados de miles de registros. */
export const TOPE_VISTA_TODOS = 5000;

export function parsePorPagina(valor: string | undefined): { porPagina: number; vista: OpcionVista } {
  const vista = (OPCIONES_VISTA as readonly string[]).includes(valor ?? "") ? (valor as OpcionVista) : VISTA_DEFECTO;
  const porPagina = vista === "todos" ? TOPE_VISTA_TODOS : Number(vista);
  return { porPagina, vista };
}
