import { permanentRedirect } from "next/navigation";

/**
 * /negocios-verdes/buscar era la página de búsqueda de la plataforma anterior: se lleva al buscador
 * de la página de inicio conservando el filtro (q, municipio, categoria, subcategoria, actividad) y
 * pasando avalado=1 / sello=1 / emprendimiento=1 al filtro de reconocimiento.
 */
export default async function BuscarAnteriorNV({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const destino = new URLSearchParams();
  for (const k of ["q", "municipio", "categoria", "subcategoria", "actividad"]) {
    const v = sp[k];
    if (typeof v === "string" && v.trim()) destino.set(k, v.trim().slice(0, 120));
  }
  const rec = (["avalado", "sello", "emprendimiento"] as const).find((k) => sp[k] === "1" || sp[k] === "true");
  if (rec) destino.set("reconocimiento", rec);
  const q = destino.toString();
  permanentRedirect(`/negocios-verdes${q ? `?${q}` : ""}#buscar`);
}
