/**
 * Colores del menú lateral que cada persona puede escoger. Es una preferencia visual del navegador:
 * se guarda en una cookie (para que el servidor pinte el color correcto desde la primera carga, sin parpadeo)
 * y no toca permisos ni la base de datos. Los colores reales viven en globals.css como variables CSS.
 */
export const TEMAS_MENU = [
  { id: "verde", nombre: "Verde institucional", muestra: "#035640", acento: "#85c800" },
  { id: "azul", nombre: "Azul noche", muestra: "#263257", acento: "#7dd3fc" },
  { id: "pizarra", nombre: "Gris pizarra", muestra: "#334155", acento: "#fbbf24" },
  { id: "petroleo", nombre: "Petróleo", muestra: "#134e4a", acento: "#5eead4" },
  { id: "vino", nombre: "Vino", muestra: "#5b1a2b", acento: "#fda4af" },
  { id: "grafito", nombre: "Grafito", muestra: "#262626", acento: "#85c800" },
] as const;

export type TemaMenu = (typeof TEMAS_MENU)[number]["id"];

export const TEMA_MENU_PREDETERMINADO: TemaMenu = "verde";
export const COOKIE_TEMA_MENU = "tema-menu";

export function temaMenuValido(valor: string | undefined | null): TemaMenu {
  return TEMAS_MENU.some((t) => t.id === valor) ? (valor as TemaMenu) : TEMA_MENU_PREDETERMINADO;
}
