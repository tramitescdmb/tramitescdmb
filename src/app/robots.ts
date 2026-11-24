import type { MetadataRoute } from "next";
import { urlPublicaNV } from "@/lib/negocios-verdes-sitio";

/** Buscadores: solo el sitio público de Negocios Verdes tiene sentido indexarlo; el panel y las API no. */
export default function robots(): MetadataRoute.Robots {
  const base = urlPublicaNV() || (process.env.URL_PLATAFORMA ?? "").replace(/\/+$/, "");
  return {
    rules: [{ userAgent: "*", allow: ["/negocios-verdes"], disallow: ["/negocios-verdes/admin", "/negocios-verdes/geovisor/embed", "/api/"] }],
    sitemap: base ? `${base}/negocios-verdes/sitemap.xml` : undefined,
  };
}
