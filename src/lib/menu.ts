export type RutaMenu = { href: string; exacto?: boolean; prefijo?: string | string[] };

/** Rutas que pertenecen a la entrada única «Dashboard» del menú (Mi trabajo y Dashboard general). */
export const RUTAS_DASHBOARD = ["/", "/dashboard"];

/** Indica si una entrada del menú debe marcarse como activa para la ruta actual. */
export function itemActivo(item: RutaMenu, pathname: string): boolean {
  if (item.prefijo) {
    const prefijos = Array.isArray(item.prefijo) ? item.prefijo : [item.prefijo];
    return prefijos.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")));
  }
  if (item.exacto) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

/** Las páginas del dashboard no llevan una segunda miga: el inicio de la ruta ya es «Dashboard». */
export function esRutaDashboard(pathname: string): boolean {
  return pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}
