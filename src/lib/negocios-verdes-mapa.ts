/**
 * Geovisor público de Negocios Verdes (puro, sin base de datos): puntos del mapa, filtro en el
 * navegador y descargas. Solo usa campos de NegocioPublico, que ya es la lista blanca de lo público.
 */
import Papa from "papaparse";
import { normalizarTexto, type NegocioPublico } from "@/lib/negocios-verdes";

export type PuntoMapaNV = {
  slug: string;
  nombre: string;
  municipio: string;
  vereda: string | null;
  lat: number;
  lng: number;
  descripcionCorta: string | null;
  fotoUrl: string | null;
  categoria: { nombre: string; slug: string; icono: string | null } | null;
  categorias: string[];
  avalado: boolean;
  selloMarca: boolean;
  emprendimientoVerde: boolean;
  /** Texto sin tildes para buscar por palabras. */
  texto: string;
};

/** Caja de la jurisdicción con margen: un punto fuera de ella es un error de digitación y no se dibuja. */
const CAJA = { latMin: 6.5, latMax: 7.9, lngMin: -73.6, lngMax: -72.4 };

export function coordenadaEnJurisdiccion(lat: number | null, lng: number | null): boolean {
  return lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) && lat >= CAJA.latMin && lat <= CAJA.latMax && lng >= CAJA.lngMin && lng <= CAJA.lngMax;
}

export function aPuntoMapa(n: NegocioPublico): PuntoMapaNV | null {
  if (!coordenadaEnJurisdiccion(n.latitud, n.longitud)) return null;
  return {
    slug: n.slug,
    nombre: n.nombre,
    municipio: n.municipio,
    vereda: n.vereda,
    lat: n.latitud!,
    lng: n.longitud!,
    descripcionCorta: n.descripcionCorta,
    fotoUrl: n.fotoPortadaUrl,
    categoria: n.categoria ? { nombre: n.categoria.nombre, slug: n.categoria.slug, icono: n.categoria.icono } : null,
    categorias: n.categorias.map((c) => c.slug),
    avalado: n.avalado,
    selloMarca: n.selloMarca,
    emprendimientoVerde: n.emprendimientoVerde,
    texto: normalizarTexto(
      [n.nombre, n.descripcionCorta, n.municipio, n.vereda, n.producto, ...n.categorias.map((c) => c.nombre), ...n.subcategorias.map((s) => s.nombre), ...n.actividades.map((a) => a.nombre)].join(" ")
    ),
  };
}

export type FiltroMapaNV = { q: string; municipio: string; categoria: string; reconocimiento: "" | "avalado" | "sello" | "emprendimiento" };

export function filtrarPuntos(puntos: PuntoMapaNV[], f: FiltroMapaNV): PuntoMapaNV[] {
  const palabras = normalizarTexto(f.q).split(" ").filter(Boolean);
  return puntos.filter(
    (p) =>
      (!f.municipio || p.municipio === f.municipio) &&
      (!f.categoria || p.categorias.includes(f.categoria)) &&
      (f.reconocimiento !== "avalado" || p.avalado) &&
      (f.reconocimiento !== "sello" || p.selloMarca) &&
      (f.reconocimiento !== "emprendimiento" || p.emprendimientoVerde) &&
      palabras.every((w) => p.texto.includes(w))
  );
}

/** Color fijo por categoría (las tres oficiales del PNNV y un gris para lo demás). */
export function colorCategoria(slug: string | undefined): string {
  if (!slug) return "#6B7280";
  if (slug.startsWith("bioproductos")) return "#2E7D32";
  if (slug.startsWith("ecoproductos")) return "#0277BD";
  if (slug.includes("calidad-ambiental")) return "#EF6C00";
  return "#6B7280";
}

const propiedades = (p: PuntoMapaNV, base: string) => ({
  nombre: p.nombre,
  municipio: p.municipio,
  vereda: p.vereda,
  categoria: p.categoria?.nombre ?? null,
  avalado: p.avalado,
  sello_marca: p.selloMarca,
  emprendimiento_verde: p.emprendimientoVerde,
  ficha: `${base}/negocios-verdes/negocio/${encodeURIComponent(p.slug)}`,
});

export function puntosGeoJSON(puntos: PuntoMapaNV[], base: string): string {
  return JSON.stringify({
    type: "FeatureCollection",
    features: puntos.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lng, p.lat] }, properties: propiedades(p, base) })),
  });
}

export function puntosCsv(puntos: PuntoMapaNV[], base: string): string {
  const filas = puntos.map((p) => {
    const o = propiedades(p, base);
    return [o.nombre, o.municipio, o.vereda ?? "", o.categoria ?? "", p.lat, p.lng, o.avalado ? "SI" : "NO", o.sello_marca ? "SI" : "NO", o.emprendimiento_verde ? "SI" : "NO", o.ficha].map((v) => {
      const t = String(v);
      return /^[=+\-@\t\r]/.test(t) && !/^-?\d+([.,]\d+)?$/.test(t) ? `'${t}` : t;
    });
  });
  return "﻿" + Papa.unparse({ fields: ["nombre", "municipio", "vereda", "categoria", "latitud", "longitud", "avalado", "sello_marca", "emprendimiento_verde", "ficha"], data: filas }, { delimiter: ";" });
}

/** Estado del geovisor que se guarda en el enlace para compartir (?q=&municipio=&categoria=&reconocimiento=&capas=&v=lat,lng,zoom). */
export function leerVistaMapa(sp: URLSearchParams): { filtro: FiltroMapaNV; capas: string[]; vista: [number, number, number] | null; negocio: string | null } {
  const rec = sp.get("reconocimiento") ?? "";
  const v = (sp.get("v") ?? "").split(",").map(Number);
  return {
    filtro: {
      q: (sp.get("q") ?? "").slice(0, 120),
      municipio: (sp.get("municipio") ?? sp.get("mun") ?? "").slice(0, 60), // «mun»: enlaces de la plataforma anterior
      categoria: (sp.get("categoria") ?? "").slice(0, 120),
      reconocimiento: rec === "avalado" || rec === "sello" || rec === "emprendimiento" ? rec : "",
    },
    capas: (sp.get("capas") ?? "").split(",").filter((c) => /^[a-z_]{2,20}$/.test(c)).slice(0, 10),
    // ?negocio=slug: el geovisor se acerca a ese negocio y abre su aviso (desde la ficha o el buscador).
    negocio: /^[a-z0-9-]{1,120}$/.test(sp.get("negocio") ?? "") ? sp.get("negocio") : null,
    vista: v.length === 3 && coordenadaEnJurisdiccion(v[0]!, v[1]!) && v[2]! >= 8 && v[2]! <= 19 ? [v[0]!, v[1]!, Math.round(v[2]!)] : null,
  };
}

export function escribirVistaMapa(filtro: FiltroMapaNV, capas: string[], vista: [number, number, number] | null): string {
  const sp = new URLSearchParams();
  for (const [k, val] of Object.entries(filtro)) if (val) sp.set(k, val);
  if (capas.length) sp.set("capas", capas.join(","));
  if (vista) sp.set("v", `${vista[0].toFixed(5)},${vista[1].toFixed(5)},${vista[2]}`);
  return sp.toString();
}
