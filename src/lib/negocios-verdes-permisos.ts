import { tienePermiso, type PermisosUsuario } from "@/lib/permisos";

/**
 * Acceso al panel interno de Negocios Verdes. Además del perfil, el módulo debe estar habilitado
 * para la persona y visible en /admin/modulos (eso ya lo resuelve `permisos.modulos`).
 * El administrador del SIC entra siempre.
 */
export function accedePanelNV(p: PermisosUsuario): boolean {
  if (p.esAdmin) return true;
  return p.modulos.has("NEGOCIOS_VERDES") && tienePermiso(p, "negociosVerdes.gestion", "LEER");
}

/** Crear, editar o eliminar negocios, personas, productos y puntajes; importar CSV. */
export function puedeGestionarNV(p: PermisosUsuario, accion: "CREAR" | "ACTUALIZAR" | "ELIMINAR"): boolean {
  if (p.esAdmin) return true;
  return accedePanelNV(p) && tienePermiso(p, "negociosVerdes.gestion", accion);
}

/** Taxonomía (categorías, subcategorías, actividades) y apariencia del sitio público. */
export function puedeConfigurarNV(p: PermisosUsuario): boolean {
  if (p.esAdmin) return true;
  return accedePanelNV(p) && tienePermiso(p, "negociosVerdes.configuracion", "ACTUALIZAR");
}
