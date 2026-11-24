import { getConfiguracionSitio } from "@/lib/config-sitio";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { accedePanelNV } from "@/lib/negocios-verdes-permisos";

/**
 * ¿Se muestra el sitio público? Sí si la casilla «Negocios Verdes — Sitio público» está encendida;
 * si está apagada, solo quien tiene acceso al panel lo ve, en vista previa.
 */
export async function accesoSitioNV(): Promise<{ abierto: boolean; vistaPrevia: boolean }> {
  const config = await getConfiguracionSitio();
  if (config.negociosVerdesSitioPublico === true) return { abierto: true, vistaPrevia: false };
  const session = await verificarSesion();
  return { abierto: false, vistaPrevia: Boolean(session && accedePanelNV(await obtenerPermisosUsuario(session.userId))) };
}
