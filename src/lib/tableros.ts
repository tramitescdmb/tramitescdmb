import { puedeAccederContratacion, puedeAccederCorrespondencia, puedeAccederSeccion, type PermisosUsuario } from "@/lib/permisos";
import { sincaConfigurado } from "@/lib/sinca";

export type OpcionTablero = { href: string; label: string; grupo?: string };

export function tablerosDeModulo(permisos: PermisosUsuario): OpcionTablero[] {
  const grupo = "Dashboard de módulo";
  return [
    ...(permisos.modulos.has("TRAMITES") ? [{ href: "/tramites-ambientales", label: "Trámites ambientales 2.0", grupo }] : []),
    ...(puedeAccederContratacion(permisos) ? [{ href: "/contratacion/panel", label: "GECON", grupo }] : []),
    ...(puedeAccederCorrespondencia(permisos) ? [{ href: "/correspondencia/panel", label: "SGDEA CDMB", grupo }] : []),
    ...(puedeAccederSeccion(permisos, "VITAL_DASHBOARD") ? [{ href: "/vital/dashboard", label: "VITAL", grupo }] : []),
    ...(sincaConfigurado() && puedeAccederSeccion(permisos, "SINCA_DASHBOARD") ? [{ href: "/historico", label: "SINCA 1.0", grupo }] : []),
  ];
}

export function opcionesTablero(permisos: PermisosUsuario): OpcionTablero[] {
  return [{ href: "/", label: "Mi trabajo" }, { href: "/dashboard", label: "Dashboard general" }, ...tablerosDeModulo(permisos)];
}
