import { db } from "@/lib/db";
import { todosLosSuitNumeros } from "@/lib/tramite-categoria";
import type { TramiteOpcion } from "@/components/vital/tramite-opciones";

export type EntradaCatalogo = TramiteOpcion & { flujo: string | null };

/**
 * Entradas del catálogo de trámites para un selector, con los mismos grupos y conteos del catálogo:
 * un trámite con varios procedimientos, todos inscritos en el SUIT, sale una vez por procedimiento.
 * Los trámites sin procedimiento en SIC salen como no radicables. Ordenadas por nombre.
 */
export async function entradasCatalogo(href: (slug: string, flujo: string | null) => string): Promise<EntradaCatalogo[]> {
  const tramites = await db.tramiteTipo.findMany({
    where: { activo: true },
    select: { slug: true, nombre: true, codigo: true, suitNumeros: true, flujos: { select: { codigo: true, nombre: true, suitNumero: true } } },
    orderBy: { nombre: "asc" },
  });
  const opciones: EntradaCatalogo[] = [];
  for (const t of tramites) {
    const enSuit = todosLosSuitNumeros(t).length > 0;
    const radicable = t.flujos.length > 0;
    const porFlujo = t.flujos.length >= 2 && t.flujos.every((f) => f.suitNumero);
    if (porFlujo) {
      for (const f of t.flujos) {
        opciones.push({ clave: `${t.slug}:${f.codigo}`, href: href(t.slug, f.codigo), nombre: f.nombre, codigo: t.codigo, suits: f.suitNumero ? [f.suitNumero] : [], enSuit, radicable, flujo: f.codigo });
      }
    } else {
      opciones.push({ clave: t.slug, href: href(t.slug, null), nombre: t.nombre, codigo: t.codigo, suits: todosLosSuitNumeros(t), enSuit, radicable, flujo: null });
    }
  }
  return opciones.sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
}
