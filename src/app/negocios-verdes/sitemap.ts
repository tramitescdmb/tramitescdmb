import type { MetadataRoute } from "next";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { listarNegociosPublicos } from "@/lib/negocios-verdes-data";

export const dynamic = "force-dynamic";

/** /negocios-verdes/sitemap.xml: páginas del sitio público y fichas publicadas (vacío mientras el sitio esté apagado). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = await getConfiguracionSitio();
  if (!config.negociosVerdesSitioPublico) return [];
  const base = (process.env.URL_PLATAFORMA ?? "").replace(/\/+$/, "");
  const fijas = ["", "/geovisor", "/nosotros", "/plan-nacional", "/contacto"].map((p) => ({ url: `${base}/negocios-verdes${p}`, changeFrequency: "weekly" as const, priority: p ? 0.6 : 1 }));
  const negocios = await listarNegociosPublicos();
  return [...fijas, ...negocios.map((n) => ({ url: `${base}/negocios-verdes/negocio/${encodeURIComponent(n.slug)}`, changeFrequency: "monthly" as const, priority: 0.8 }))];
}
