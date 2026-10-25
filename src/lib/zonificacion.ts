import { puntoEnGeometria, type GeometriaPoligono } from "@/lib/jurisdiccion-cdmb";

export const ZONAS = {
  municipio: "Municipio (capa de la jurisdicción)",
  vereda: "Vereda (DANE)",
  subzona_hidrografica: "Subzona hidrográfica (IDEAM)",
  areas_protegidas: "Áreas protegidas (RUNAP)",
  aica: "AICA (Humboldt)",
  paramo: "Páramo (MADS)",
  bosque_seco: "Bosque seco tropical (MADS)",
  resumen_ambiental: "Resumen de determinantes ambientales",
} as const;
export type ClaveZona = keyof typeof ZONAS;

type Propiedades = Record<string, unknown>;
export type CapaZonificacion = { features: { properties: Propiedades | null; geometry: { type: string; coordinates: unknown } | null }[] };
export type CapasZonificacion = Partial<Record<"municipios" | "veredas" | "subzonas" | "areas_protegidas" | "aicas" | "paramos" | "bosque_seco", CapaZonificacion>>;

export const ARCHIVOS_CAPAS: Record<keyof CapasZonificacion, string> = {
  municipios: "/geo/municipios_cdmb.geojson",
  veredas: "/geo/veredas_cdmb.geojson",
  subzonas: "/geo/subzonas_cdmb.geojson",
  areas_protegidas: "/geo/areas_protegidas_cdmb.geojson",
  aicas: "/geo/aicas_cdmb.geojson",
  paramos: "/geo/paramos_cdmb.geojson",
  bosque_seco: "/geo/bosque_seco_cdmb.geojson",
};

function coincidencias(lat: number, lon: number, capa: CapaZonificacion | undefined): Propiedades[] {
  if (!capa) return [];
  return capa.features
    .filter((f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") && puntoEnGeometria(lat, lon, f.geometry as GeometriaPoligono))
    .map((f) => f.properties ?? {});
}

const s = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

export type ResultadoZonificacion = Record<ClaveZona, string>;

export function zonificarPunto(lat: number, lon: number, capas: CapasZonificacion): ResultadoZonificacion {
  const municipio = coincidencias(lat, lon, capas.municipios).map((p) => s(p.nombre)).filter(Boolean)[0] ?? "";
  const veredaProp = coincidencias(lat, lon, capas.veredas)[0];
  const vereda = veredaProp ? s(veredaProp.nombre) : "";
  const subzonaProp = coincidencias(lat, lon, capas.subzonas)[0];
  const subzona = subzonaProp ? `${s(subzonaProp.nombre)}${s(subzonaProp.codigo) ? ` (código ${s(subzonaProp.codigo)})` : ""}` : "";
  const areas = coincidencias(lat, lon, capas.areas_protegidas).map((p) => `${s(p.tipo) ? `${s(p.tipo)} ` : ""}${s(p.nombre)}`.trim());
  const aicas = coincidencias(lat, lon, capas.aicas).map((p) => `${s(p.nombre)}${s(p.codigo) ? ` (${s(p.codigo)})` : ""}`);
  const paramos = coincidencias(lat, lon, capas.paramos).map((p) => `${s(p.nombre)}${s(p.acto) ? `, delimitado por ${s(p.acto)}` : ""}`);
  const bosqueSeco = coincidencias(lat, lon, capas.bosque_seco).length > 0;

  const partes: string[] = [];
  if (vereda || municipio) partes.push(`El punto se localiza${vereda ? ` en la vereda ${vereda}` : ""}${municipio ? `${vereda ? "," : ""} municipio de ${municipio}` : ""}`);
  if (subzona) partes.push(`dentro de la subzona hidrográfica ${subzona}`);
  const frase = partes.length ? `${partes.join(", ")}.` : "El punto no se encuentra dentro de las capas de la jurisdicción de la CDMB.";
  const restricciones = [
    areas.length ? `Se ubica dentro del área protegida ${areas.join("; ")}.` : "No se ubica dentro de áreas protegidas registradas en el RUNAP.",
    aicas.length ? `Se encuentra en el Área de Importancia para la Conservación de las Aves ${aicas.join("; ")}.` : "No se encuentra en Áreas de Importancia para la Conservación de las Aves (AICA).",
    paramos.length ? `Se encuentra en el complejo de páramo ${paramos.join("; ")}.` : "No se encuentra en complejos de páramo delimitados.",
    bosqueSeco ? "Se encuentra en ecosistema de bosque seco tropical." : "No se encuentra en ecosistema de bosque seco tropical.",
  ];

  return {
    municipio,
    vereda,
    subzona_hidrografica: subzona,
    areas_protegidas: areas.join("; ") || "Ninguna",
    aica: aicas.join("; ") || "Ninguna",
    paramo: paramos.join("; ") || "No",
    bosque_seco: bosqueSeco ? "Sí" : "No",
    resumen_ambiental: `${frase} ${restricciones.join(" ")} Fuente: capas geográficas de la jurisdicción (DANE, IDEAM, RUNAP, Humboldt y MADS).`,
  };
}

let cache: Promise<CapasZonificacion> | null = null;

export function cargarCapasZonificacion(): Promise<CapasZonificacion> {
  cache ??= Promise.all(
    (Object.entries(ARCHIVOS_CAPAS) as [keyof CapasZonificacion, string][]).map(async ([clave, url]) => {
      try {
        const r = await fetch(url);
        return [clave, r.ok ? ((await r.json()) as CapaZonificacion) : undefined] as const;
      } catch {
        return [clave, undefined] as const;
      }
    })
  ).then((pares) => {
    const capas = Object.fromEntries(pares.filter(([, v]) => v)) as CapasZonificacion;
    if (Object.keys(capas).length === 0) cache = null;
    return capas;
  });
  return cache;
}
