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
  ordenTipos?: string[];
};

export type GrupoTipo = { clave: string; etiqueta: string; color: string; total: number };

export const PALETA_TIPOS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
export const COLOR_OTROS_TIPOS = "#898781";
export const CLAVE_OTROS_TIPOS = "__otros__";

export const FORMA_PLATAFORMA: Record<PlataformaExterna, "rombo" | "cuadrado"> = { sinca: "rombo", vital: "cuadrado" };

export function clasificarPorTipo(puntos: { tipo: string }[], ordenTipos?: string[]): { grupos: GrupoTipo[]; grupoDe: (tipo: string) => GrupoTipo } {
  const exactos = new Map<string, number>();
  for (const p of puntos) exactos.set(p.tipo, (exactos.get(p.tipo) ?? 0) + 1);
  const total = (t: string) => exactos.get(t) ?? 0;
  const tipos = [...new Set([...(ordenTipos ?? []), ...exactos.keys()])];
  const orden = ordenTipos
    ? tipos.sort((a, b) => {
        const ia = ordenTipos.indexOf(a);
        const ib = ordenTipos.indexOf(b);
        return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib) || a.localeCompare(b, "es");
      })
    : tipos.sort((a, b) => total(b) - total(a) || a.localeCompare(b, "es"));
  const conColor = orden.slice(0, PALETA_TIPOS.length);
  const resto = orden.slice(PALETA_TIPOS.length);
  const todos: GrupoTipo[] = conColor.map((tipo, i) => ({
    clave: tipo,
    etiqueta: tipo,
    color: PALETA_TIPOS[i]!,
    total: total(tipo),
  }));
  const restoConPuntos = resto.filter((t) => total(t) > 0);
  const otros: GrupoTipo = {
    clave: CLAVE_OTROS_TIPOS,
    etiqueta: `Otros tipos (${restoConPuntos.length})`,
    color: COLOR_OTROS_TIPOS,
    total: restoConPuntos.reduce((s, t) => s + total(t), 0),
  };
  if (restoConPuntos.length > 0) todos.push(otros);
  const grupos = todos.filter((g) => g.total > 0);
  const porTipo = new Map(todos.map((g) => [g.clave, g]));
  return { grupos, grupoDe: (tipo) => porTipo.get(tipo) ?? otros };
}

export const LETRA_PLATAFORMA: Record<PlataformaExterna, string> = { sinca: "S", vital: "V" };

export function svgMarcadorExterno(forma: "rombo" | "cuadrado", color: string, tamano = 22, letra?: string): string {
  const figura =
    forma === "rombo"
      ? `<rect x="4.5" y="4.5" width="15" height="15" rx="2" transform="rotate(45 12 12)" fill="${color}" stroke="#ffffff" stroke-width="1.6"/>`
      : `<rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="${color}" stroke="#ffffff" stroke-width="1.6"/>`;
  const texto = letra
    ? `<text x="12" y="16" text-anchor="middle" font-family="Work Sans, Arial, sans-serif" font-size="11" font-weight="700" fill="#ffffff" stroke="rgba(0,0,0,.55)" stroke-width="2" paint-order="stroke">${letra}</text>`
    : "";
  return `<svg width="${tamano}" height="${tamano}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.45))">${figura}${texto}</svg>`;
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
