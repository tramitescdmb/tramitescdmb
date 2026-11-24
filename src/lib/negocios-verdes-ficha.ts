/**
 * Negocios Verdes: campos editables de un negocio y su validación (pura, sin base de datos).
 * Los de la ficha técnica son internos de la CDMB y se guardan en NvNegocio.fichaTecnica con las
 * mismas claves que tenían en la plataforma anterior (nit, concesion_aguas, …).
 */
import { esMunicipioNV, slugNV, type MunicipioNV } from "@/lib/negocios-verdes";

export type TipoCampoFicha = "texto" | "textoLargo" | "fecha" | "entero" | "lista";

export type CampoFicha = {
  clave: string;
  etiqueta: string;
  tipo: TipoCampoFicha;
  grupo: "Identificación" | "Permisos y registros" | "Gestión ambiental" | "Mercado" | "Fortalezas" | "Seguimiento";
  /** Valores fijos (tipo «lista» sin catálogo editable). */
  valores?: readonly string[];
  /** Tiene opciones sugeridas en NvOpcionCampo (se puede escribir otra). */
  catalogo?: boolean;
};

export const NATURALEZAS = ["Natural", "Jurídica"] as const;
export const NOVEDADES = ["ACTIVO", "INACTIVO", "RETIRADO", "SUSPENDIDO"] as const;

export const CAMPOS_FICHA: readonly CampoFicha[] = [
  { clave: "nit", etiqueta: "NIT o cédula", tipo: "texto", grupo: "Identificación" },
  { clave: "naturaleza_juridica", etiqueta: "Naturaleza jurídica", tipo: "lista", valores: NATURALEZAS, grupo: "Identificación" },
  { clave: "rut_camara_comercio", etiqueta: "RUT / Cámara de Comercio", tipo: "texto", catalogo: true, grupo: "Identificación" },
  { clave: "tipo_negocio_verde", etiqueta: "Tipo de negocio verde", tipo: "texto", catalogo: true, grupo: "Identificación" },
  { clave: "anio_registro", etiqueta: "Año de registro", tipo: "entero", grupo: "Identificación" },
  { clave: "responsable_cdmb", etiqueta: "Responsable CDMB (texto anterior)", tipo: "texto", catalogo: true, grupo: "Identificación" },
  { clave: "delegado", etiqueta: "Delegado (texto anterior)", tipo: "texto", catalogo: true, grupo: "Identificación" },
  { clave: "este", etiqueta: "Coordenada Este", tipo: "texto", grupo: "Identificación" },
  { clave: "norte", etiqueta: "Coordenada Norte", tipo: "texto", grupo: "Identificación" },
  { clave: "cota_msnm", etiqueta: "Cota (m s. n. m.)", tipo: "texto", grupo: "Identificación" },

  { clave: "registro_nacional_turismo", etiqueta: "Registro Nacional de Turismo", tipo: "texto", catalogo: true, grupo: "Permisos y registros" },
  { clave: "uso_suelo", etiqueta: "Uso del suelo", tipo: "texto", catalogo: true, grupo: "Permisos y registros" },
  { clave: "concesion_aguas", etiqueta: "Concesión de aguas", tipo: "texto", catalogo: true, grupo: "Permisos y registros" },
  { clave: "concesion_aguas_vencimiento", etiqueta: "Vence concesión de aguas", tipo: "fecha", grupo: "Permisos y registros" },
  { clave: "vertimientos", etiqueta: "Permiso de vertimientos", tipo: "texto", catalogo: true, grupo: "Permisos y registros" },
  { clave: "vertimientos_vencimiento", etiqueta: "Vence permiso de vertimientos", tipo: "fecha", grupo: "Permisos y registros" },
  { clave: "ica", etiqueta: "Registro ICA", tipo: "texto", catalogo: true, grupo: "Permisos y registros" },
  { clave: "ica_vencimiento", etiqueta: "Vence registro ICA", tipo: "fecha", grupo: "Permisos y registros" },
  { clave: "invima", etiqueta: "Registro INVIMA", tipo: "texto", catalogo: true, grupo: "Permisos y registros" },
  { clave: "invima_vencimiento", etiqueta: "Vence registro INVIMA", tipo: "fecha", grupo: "Permisos y registros" },
  { clave: "certificado_tenencia_animales", etiqueta: "Certificado de tenencia de animales", tipo: "texto", catalogo: true, grupo: "Permisos y registros" },
  { clave: "registro_apicola", etiqueta: "Registro apícola", tipo: "texto", catalogo: true, grupo: "Permisos y registros" },
  { clave: "intervencion_cauce", etiqueta: "Permiso de intervención de cauce", tipo: "texto", catalogo: true, grupo: "Permisos y registros" },

  { clave: "pueaa", etiqueta: "PUEAA", tipo: "texto", catalogo: true, grupo: "Gestión ambiental" },
  { clave: "pgris", etiqueta: "PGIRS", tipo: "texto", catalogo: true, grupo: "Gestión ambiental" },
  { clave: "pozo_septico", etiqueta: "Pozo séptico", tipo: "texto", catalogo: true, grupo: "Gestión ambiental" },
  { clave: "alcantarillado", etiqueta: "Alcantarillado", tipo: "texto", catalogo: true, grupo: "Gestión ambiental" },
  { clave: "buenas_practicas_agricolas", etiqueta: "Buenas prácticas agrícolas", tipo: "texto", catalogo: true, grupo: "Gestión ambiental" },
  { clave: "buenas_practicas_apicolas", etiqueta: "Buenas prácticas apícolas", tipo: "texto", catalogo: true, grupo: "Gestión ambiental" },
  { clave: "capacidad_carga", etiqueta: "Capacidad de carga", tipo: "texto", catalogo: true, grupo: "Gestión ambiental" },
  { clave: "sstt", etiqueta: "SG-SST", tipo: "texto", catalogo: true, grupo: "Gestión ambiental" },
  { clave: "huella_carbono", etiqueta: "Huella de carbono", tipo: "texto", grupo: "Gestión ambiental" },

  { clave: "canal_venta", etiqueta: "Canal de venta", tipo: "texto", catalogo: true, grupo: "Mercado" },
  { clave: "exportacion", etiqueta: "Exportación", tipo: "texto", catalogo: true, grupo: "Mercado" },

  { clave: "fortalezas_ambiental", etiqueta: "Fortalezas: ambiental", tipo: "textoLargo", grupo: "Fortalezas" },
  { clave: "fortalezas_social", etiqueta: "Fortalezas: social", tipo: "textoLargo", grupo: "Fortalezas" },
  { clave: "fortalezas_economico", etiqueta: "Fortalezas: económico", tipo: "textoLargo", grupo: "Fortalezas" },

  { clave: "novedad", etiqueta: "Novedad", tipo: "lista", valores: NOVEDADES, grupo: "Seguimiento" },
  { clave: "aplicacion_ficha_2025", etiqueta: "Aplicación de ficha 2025", tipo: "texto", catalogo: true, grupo: "Seguimiento" },
  { clave: "observaciones", etiqueta: "Observaciones", tipo: "textoLargo", grupo: "Seguimiento" },
];

const CAMPO_POR_CLAVE = new Map(CAMPOS_FICHA.map((c) => [c.clave, c]));

export type ValorFicha = string | number;

/**
 * Limpia la ficha técnica que envía el formulario: solo claves del catálogo, tipos correctos y sin
 * vacíos. Las claves que la fila ya tenía y que no están en el catálogo se conservan tal cual
 * (datos traídos de la plataforma anterior que no se editan aquí).
 */
export function limpiarFicha(entrada: unknown, anterior: Record<string, unknown> = {}): { ficha: Record<string, ValorFicha>; errores: string[] } {
  const errores: string[] = [];
  const ficha: Record<string, ValorFicha> = {};
  for (const [k, v] of Object.entries(anterior)) {
    if (!CAMPO_POR_CLAVE.has(k) && (typeof v === "string" || typeof v === "number")) ficha[k] = v;
  }
  const obj = entrada && typeof entrada === "object" ? (entrada as Record<string, unknown>) : {};
  for (const campo of CAMPOS_FICHA) {
    const crudo = obj[campo.clave];
    const t = typeof crudo === "number" ? String(crudo) : typeof crudo === "string" ? crudo.trim() : "";
    if (!t) continue;
    switch (campo.tipo) {
      case "entero": {
        const n = Number(t);
        if (!Number.isInteger(n) || n < 1900 || n > 2100) errores.push(`${campo.etiqueta}: escriba un año válido.`);
        else ficha[campo.clave] = n;
        break;
      }
      case "fecha":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(t))) errores.push(`${campo.etiqueta}: fecha no válida.`);
        else ficha[campo.clave] = t;
        break;
      case "lista":
        if (!campo.valores?.includes(t)) errores.push(`${campo.etiqueta}: valor no válido.`);
        else ficha[campo.clave] = t;
        break;
      default:
        ficha[campo.clave] = t.slice(0, campo.tipo === "textoLargo" ? 4000 : 300);
    }
  }
  return { ficha, errores };
}

// ─── Datos principales ──────────────────────────────────────────────────────

export type EntradaNegocio = {
  nombre?: unknown;
  slug?: unknown;
  municipio?: unknown;
  veredaId?: unknown;
  direccion?: unknown;
  latitud?: unknown;
  longitud?: unknown;
  descripcionCorta?: unknown;
  descripcion?: unknown;
  producto?: unknown;
  telefono?: unknown;
  telefonoSecundario?: unknown;
  whatsapp?: unknown;
  email?: unknown;
  sitioWeb?: unknown;
  facebookUrl?: unknown;
  instagramUrl?: unknown;
  representanteLegal?: unknown;
  emprendimientoVerde?: unknown;
  selloMarca?: unknown;
  avalado?: unknown;
  destacado?: unknown;
  activo?: unknown;
  categoriaId?: unknown;
  categoriaIds?: unknown;
  subcategoriaIds?: unknown;
  actividadIds?: unknown;
  fotoPortadaRuta?: unknown;
  fotos?: unknown;
  productos?: unknown;
  fichaTecnica?: unknown;
};

export type NegocioValidado = {
  nombre: string;
  slug: string;
  municipio: MunicipioNV;
  veredaId: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  descripcionCorta: string | null;
  descripcion: string | null;
  producto: string | null;
  telefono: string | null;
  telefonoSecundario: string | null;
  whatsapp: string | null;
  email: string | null;
  sitioWeb: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  representanteLegal: string | null;
  emprendimientoVerde: boolean;
  selloMarca: boolean;
  avalado: boolean;
  destacado: boolean;
  activo: boolean;
  categoriaId: string;
  categoriaIds: string[];
  subcategoriaIds: string[];
  actividadIds: string[];
  fotoPortadaRuta: string | null;
  fotos: string[];
  productos: { orden: number; nombre: string | null; descripcion: string | null; fotoRuta: string | null }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const txt = (v: unknown, max = 300): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};
const bool = (v: unknown) => v === true || v === "on" || v === "true";
const ids = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && UUID.test(x)))] : []);

/**
 * Ruta de imagen aceptable para un negocio: solo dentro de su carpeta del almacén (la que asigna la
 * subida) o la que ya tenía (traída de la plataforma anterior). Evita apuntar a archivos ajenos.
 */
export function rutaImagenValida(ruta: unknown, negocioId: string | null, anteriores: Set<string>): string | null {
  if (typeof ruta !== "string" || !ruta) return null;
  if (anteriores.has(ruta)) return ruta;
  if (ruta.split("/").some((p) => p === ".." || p === "." || p === "")) return null;
  // Un negocio nuevo no tiene carpeta todavía: las fotos se suben después de guardarlo por primera vez.
  if (!negocioId || !ruta.startsWith(`negocios-fotos/${negocioId}/`)) return null;
  return /^[A-Za-z0-9._/-]+$/.test(ruta) ? ruta : null;
}

function coordenada(v: unknown, min: number, max: number, nombre: string, errores: string[]): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(typeof v === "string" ? v.replace(",", ".") : v);
  if (!Number.isFinite(n) || n < min || n > max) {
    errores.push(`${nombre} fuera de rango.`);
    return null;
  }
  return n;
}

export function validarNegocio(e: EntradaNegocio, opciones: { negocioId: string | null; imagenesAnteriores?: Set<string> }): { datos: NegocioValidado | null; errores: string[] } {
  const errores: string[] = [];
  const anteriores = opciones.imagenesAnteriores ?? new Set<string>();
  const nombre = txt(e.nombre, 200);
  if (!nombre) errores.push("Escriba el nombre del negocio.");
  const slug = slugNV(txt(e.slug, 120) ?? nombre ?? "");
  if (!slug) errores.push("La dirección (slug) quedó vacía.");
  const municipio = txt(e.municipio);
  if (!esMunicipioNV(municipio)) errores.push("Elija uno de los 13 municipios.");
  const categoriaIds = ids(e.categoriaIds);
  const categoriaId = typeof e.categoriaId === "string" && UUID.test(e.categoriaId) ? e.categoriaId : categoriaIds[0];
  if (!categoriaId) errores.push("Elija al menos una categoría.");
  if (categoriaId && !categoriaIds.includes(categoriaId)) categoriaIds.unshift(categoriaId);
  const latitud = coordenada(e.latitud, -5, 15, "Latitud", errores);
  const longitud = coordenada(e.longitud, -82, -66, "Longitud", errores);
  if ((latitud === null) !== (longitud === null)) errores.push("Escriba latitud y longitud juntas, o ninguna.");
  const email = txt(e.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errores.push("El correo no es válido.");
  const veredaId = typeof e.veredaId === "string" && UUID.test(e.veredaId) ? e.veredaId : null;

  const fotos = Array.isArray(e.fotos) ? e.fotos.map((r) => rutaImagenValida(r, opciones.negocioId, anteriores)).filter((r): r is string => Boolean(r)).slice(0, 12) : [];
  const productos: NegocioValidado["productos"] = [];
  if (Array.isArray(e.productos)) {
    for (const [i, p] of e.productos.slice(0, 3).entries()) {
      const o = p && typeof p === "object" ? (p as Record<string, unknown>) : {};
      const prod = { orden: i, nombre: txt(o.nombre, 80), descripcion: txt(o.descripcion, 300), fotoRuta: rutaImagenValida(o.fotoRuta, opciones.negocioId, anteriores) };
      if (prod.nombre || prod.descripcion || prod.fotoRuta) productos.push(prod);
    }
  }
  productos.forEach((p, i) => (p.orden = i));

  if (errores.length > 0 || !nombre || !esMunicipioNV(municipio) || !categoriaId) return { datos: null, errores };
  return {
    errores,
    datos: {
      nombre,
      slug,
      municipio,
      veredaId,
      direccion: txt(e.direccion),
      latitud,
      longitud,
      descripcionCorta: txt(e.descripcionCorta, 400),
      descripcion: txt(e.descripcion, 5000),
      producto: txt(e.producto, 500),
      telefono: txt(e.telefono, 40),
      telefonoSecundario: txt(e.telefonoSecundario, 40),
      whatsapp: txt(e.whatsapp, 40),
      email,
      sitioWeb: txt(e.sitioWeb, 300),
      facebookUrl: txt(e.facebookUrl, 300),
      instagramUrl: txt(e.instagramUrl, 300),
      representanteLegal: txt(e.representanteLegal, 200),
      emprendimientoVerde: bool(e.emprendimientoVerde),
      selloMarca: bool(e.selloMarca),
      avalado: bool(e.avalado),
      destacado: bool(e.destacado),
      activo: bool(e.activo),
      categoriaId,
      categoriaIds,
      subcategoriaIds: ids(e.subcategoriaIds),
      actividadIds: ids(e.actividadIds),
      fotoPortadaRuta: rutaImagenValida(e.fotoPortadaRuta, opciones.negocioId, anteriores),
      fotos,
      productos,
    },
  };
}

/** Puntajes por año: 0 a 100 con dos decimales; un año por fila. */
export function validarPuntajes(entrada: unknown): { puntajes: { anio: number; puntaje: number }[]; errores: string[] } {
  const errores: string[] = [];
  const porAnio = new Map<number, number>();
  if (Array.isArray(entrada)) {
    for (const x of entrada) {
      const o = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
      const anio = Number(o.anio);
      const puntaje = Number(typeof o.puntaje === "string" ? o.puntaje.replace(",", ".") : o.puntaje);
      if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
        errores.push(`Año no válido: ${String(o.anio ?? "")}`);
        continue;
      }
      if (!Number.isFinite(puntaje) || puntaje < 0 || puntaje > 100) {
        errores.push(`Puntaje de ${anio} fuera de 0 a 100.`);
        continue;
      }
      porAnio.set(anio, Math.round(puntaje * 100) / 100);
    }
  }
  return { puntajes: [...porAnio].map(([anio, puntaje]) => ({ anio, puntaje })).sort((a, b) => a.anio - b.anio), errores };
}
