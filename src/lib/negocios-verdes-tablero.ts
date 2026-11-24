/**
 * Tablero («Panel») del administrador de Negocios Verdes: las mismas cifras y gráficas de la
 * plataforma anterior, calculadas en memoria sobre una fila liviana por negocio.
 */

export const ESTADOS_CDMB = ["ACTIVO", "INACTIVO", "RETIRADO", "SUSPENDIDO"] as const;

export type FilaTableroNV = {
  id: string;
  nombre: string;
  municipio: string;
  /** Publicado en el sitio. */
  activo: boolean;
  /** Estado CDMB («novedad» de la ficha técnica): ACTIVO, INACTIVO, RETIRADO, SUSPENDIDO o null. */
  estado: string | null;
  conFoto: boolean;
  categoria: string;
  pendiente: boolean;
  emprendimientoVerde: boolean;
  selloMarca: boolean;
  avalado: boolean;
  /** Puntaje de seguimiento por año (solo los calificados: mayor que 0). */
  puntajes: Record<number, number>;
};

export type VistaTablero = { tipo: "global" } | { tipo: "estado"; estado: string | null } | { tipo: "emprendimiento" } | { tipo: "sello" } | { tipo: "avalado" };

export function aplicaVista(f: FilaTableroNV, v: VistaTablero): boolean {
  switch (v.tipo) {
    case "global":
      return true;
    case "estado":
      return v.estado === null || (f.estado ?? "").toUpperCase() === v.estado;
    case "emprendimiento":
      return f.emprendimientoVerde;
    case "sello":
      return f.selloMarca;
    case "avalado":
      return f.avalado;
  }
}

/** Conteo por clave, de mayor a menor. */
export function contar<T>(lista: T[], clave: (x: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const x of lista) m.set(clave(x), (m.get(clave(x)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
}

export type ResumenPuntaje = { promedio: number; negocios: number };

function resumir(valores: number[]): ResumenPuntaje {
  return { promedio: valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0, negocios: valores.length };
}

export function calcularTablero(todas: FilaTableroNV[], vista: VistaTablero) {
  const filas = todas.filter((f) => aplicaVista(f, vista));
  const anios = [...new Set(filas.flatMap((f) => Object.keys(f.puntajes).map(Number)))].sort((a, b) => a - b);
  const porAnio = anios.map((anio) => ({ anio, ...resumir(filas.map((f) => f.puntajes[anio]).filter((v): v is number => typeof v === "number" && v > 0)) }));
  const estadoConcreto = vista.tipo === "estado" && vista.estado !== null;
  return {
    filas,
    publicados: filas.filter((f) => f.activo).length,
    faltanPublicar: filas.filter((f) => !f.activo && (f.estado ?? "").toUpperCase() === "ACTIVO").length,
    sinFoto: filas.filter((f) => !f.conFoto).length,
    sinClasificar: filas.filter((f) => f.pendiente).length,
    porMunicipio: contar(filas, (f) => f.municipio),
    porCategoria: contar(filas, (f) => f.categoria),
    segundaTorta: estadoConcreto
      ? { titulo: "Publicación en el sitio", datos: contar(filas, (f) => (f.activo ? "Publicado" : "Sin publicar")) }
      : { titulo: "Por estado CDMB", datos: contar(filas, (f) => (f.estado ? f.estado.toUpperCase() : "Sin estado")) },
    porAnio,
  };
}

/** Puntajes de un año: ranking de negocios y promedio por municipio. */
export function puntajesDelAnio(filas: FilaTableroNV[], anio: number) {
  const delAnio = filas
    .filter((f) => (f.puntajes[anio] ?? 0) > 0)
    .map((f) => ({ id: f.id, nombre: f.nombre, municipio: f.municipio, puntaje: f.puntajes[anio]! }))
    .sort((a, b) => b.puntaje - a.puntaje);
  const municipios = [...new Set(delAnio.map((p) => p.municipio))];
  const porMunicipio = municipios
    .map((m) => ({ municipio: m, ...resumir(delAnio.filter((p) => p.municipio === m).map((p) => p.puntaje)) }))
    .sort((a, b) => b.promedio - a.promedio);
  return { delAnio, porMunicipio, ...resumir(delAnio.map((p) => p.puntaje)) };
}

/** Las 8 combinaciones posibles de los 3 reconocimientos. */
export function combinacionesReconocimientos(filas: FilaTableroNV[]): [string, number][] {
  const c = (e: boolean, s: boolean, a: boolean) => filas.filter((f) => f.emprendimientoVerde === e && f.selloMarca === s && f.avalado === a).length;
  return [
    ["Emprendimiento Verde + Sello Marca + Avalado", c(true, true, true)],
    ["Emprendimiento Verde + Sello Marca", c(true, true, false)],
    ["Emprendimiento Verde + Avalado", c(true, false, true)],
    ["Sello Marca + Avalado", c(false, true, true)],
    ["Solo Emprendimiento Verde", c(true, false, false)],
    ["Solo Sello Marca", c(false, true, false)],
    ["Solo Avalado", c(false, false, true)],
    ["Sin ningún reconocimiento", c(false, false, false)],
  ];
}
