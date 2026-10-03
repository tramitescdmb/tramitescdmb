import type { PuntoReporte } from "@/lib/geovisor-exportar";

export type PlataformaExterna = "sinca" | "vital";

export type PuntoExterno = {
  clave: string;
  numero: string;
  tipo: string;
  detalle: string | null;
  municipio: string | null;
  estado: string | null;
  fecha: string | null;
  lat: number;
  lon: number;
  enlace: string;
};

export type CapaExterna = {
  id: PlataformaExterna;
  nombre: string;
  descripcion: string;
  puntos: PuntoExterno[];
};

export type GrupoTipo = { clave: string; etiqueta: string; color: string; total: number };

export const PALETA_TIPOS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
export const COLOR_OTROS_TIPOS = "#898781";
export const CLAVE_OTROS_TIPOS = "__otros__";

export const FORMA_PLATAFORMA: Record<PlataformaExterna, "rombo" | "cuadrado"> = { sinca: "rombo", vital: "cuadrado" };

export function clasificarPorTipo(puntos: { tipo: string }[]): { grupos: GrupoTipo[]; grupoDe: (tipo: string) => GrupoTipo } {
  const conteo = new Map<string, number>();
  for (const p of puntos) conteo.set(p.tipo, (conteo.get(p.tipo) ?? 0) + 1);
  const ordenados = [...conteo.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  const conColor = ordenados.slice(0, PALETA_TIPOS.length);
  const resto = ordenados.slice(PALETA_TIPOS.length);
  const grupos: GrupoTipo[] = conColor.map(([tipo, total], i) => ({ clave: tipo, etiqueta: tipo, color: PALETA_TIPOS[i]!, total }));
  const otros: GrupoTipo = {
    clave: CLAVE_OTROS_TIPOS,
    etiqueta: `Otros tipos (${resto.length})`,
    color: COLOR_OTROS_TIPOS,
    total: resto.reduce((s, [, n]) => s + n, 0),
  };
  if (resto.length > 0) grupos.push(otros);
  const porTipo = new Map(grupos.map((g) => [g.clave, g]));
  return { grupos, grupoDe: (tipo) => porTipo.get(tipo) ?? otros };
}

export function svgMarcadorExterno(forma: "rombo" | "cuadrado", color: string, tamano = 22): string {
  const figura =
    forma === "rombo"
      ? `<rect x="5" y="5" width="14" height="14" rx="2" transform="rotate(45 12 12)" fill="${color}" stroke="#ffffff" stroke-width="2"/>`
      : `<rect x="4" y="4" width="16" height="16" rx="3" fill="${color}" stroke="#ffffff" stroke-width="2"/>`;
  return `<svg width="${tamano}" height="${tamano}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.45))">${figura}</svg>`;
}

export function puntoExternoAReporte(capa: Pick<CapaExterna, "nombre">, p: PuntoExterno): PuntoReporte {
  return {
    id: p.clave,
    numero: p.numero,
    tramiteCodigo: "",
    tramiteNombre: p.tipo,
    municipio: p.municipio ?? "",
    estado: p.estado ?? "",
    solicitanteNombre: p.detalle ?? "",
    fechaRadicacion: p.fecha ?? "",
    lat: p.lat,
    lon: p.lon,
    plataforma: capa.nombre,
    enlace: p.enlace,
  };
}
