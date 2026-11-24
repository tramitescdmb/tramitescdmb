import { listarNegociosPublicos } from "@/lib/negocios-verdes-data";
import { aPuntoMapa, leerVistaMapa, type PuntoMapaNV } from "@/lib/negocios-verdes-mapa";

/** Datos del geovisor público: puntos con ubicación válida, categorías presentes y vista pedida en el enlace. */
export async function datosGeovisorNV(sp: Record<string, string | string[] | undefined>) {
  const negocios = await listarNegociosPublicos();
  const puntos = negocios.map(aPuntoMapa).filter((p): p is PuntoMapaNV => p !== null);
  const categorias = new Map<string, string>();
  for (const n of negocios) for (const c of n.categorias) categorias.set(c.slug, c.nombre);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") params.set(k, v);
  return {
    puntos,
    sinUbicacion: negocios.length - puntos.length,
    categorias: [...categorias].map(([slug, nombre]) => ({ slug, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    inicial: leerVistaMapa(params),
  };
}
