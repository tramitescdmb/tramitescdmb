import { enMenu, puedeAccederContratacion, puedeAccederCorrespondencia, puedeAccederSeccion, type PermisosUsuario } from "@/lib/permisos";
import { sincaConfigurado } from "@/lib/sinca";

export type OpcionTablero = { href: string; label: string; grupo?: string };

export function tablerosDeModulo(permisos: PermisosUsuario): OpcionTablero[] {
  const grupo = "Dashboard de módulo";
  return [
    ...(permisos.modulos.has("TRAMITES") && enMenu(permisos, "TRAMITES") ? [{ href: "/tramites-ambientales", label: "Trámites ambientales 2.0", grupo }] : []),
    ...(puedeAccederContratacion(permisos) && enMenu(permisos, "GECON") ? [{ href: "/contratacion/panel", label: "GECON", grupo }] : []),
    ...(puedeAccederCorrespondencia(permisos) && enMenu(permisos, "SGDEA") ? [{ href: "/correspondencia/panel", label: "SGDEA CDMB", grupo }] : []),
    ...(puedeAccederSeccion(permisos, "VITAL_DASHBOARD") && enMenu(permisos, "VITAL") ? [{ href: "/vital/dashboard", label: "VITAL", grupo }] : []),
    ...(sincaConfigurado() && puedeAccederSeccion(permisos, "SINCA_DASHBOARD") && enMenu(permisos, "SINCA") ? [{ href: "/historico", label: "SINCA 1.0", grupo }] : []),
  ];
}

export function opcionesTablero(permisos: PermisosUsuario): OpcionTablero[] {
  return [{ href: "/", label: "Mi trabajo" }, { href: "/dashboard", label: "Dashboard general" }, ...tablerosDeModulo(permisos)];
}

export function hrefLista(base: string, params: Record<string, string | undefined | null>): string {
  const q = new URLSearchParams(Object.entries(params).filter((p): p is [string, string] => Boolean(p[1])));
  const texto = q.toString();
  return texto ? `${base}?${texto}` : base;
}
