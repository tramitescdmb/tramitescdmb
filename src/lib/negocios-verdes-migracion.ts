/**
 * Traslado de Negocios Verdes desde la plataforma anterior (PostgreSQL de origen, esquema public)
 * a las tablas Nv* del SIC. Aquí solo está la conversión (pura, con pruebas); la lectura, la
 * escritura y la copia de imágenes las hace scripts/negocios-verdes-migrar.ts.
 *
 * Reglas:
 * - Se conservan los identificadores (UUID) y los slug, para que los enlaces de cada negocio sigan sirviendo.
 * - Las imágenes se copian al almacén público «negocios-verdes» del NAS con la misma ruta
 *   `<depósito>/<ruta>` que tenían en el origen; en la base queda esa ruta, no la URL anterior.
 * - Los campos de seguimiento interno de cada negocio pasan completos a `fichaTecnica`.
 * - Las contraseñas no se traen: cada administrador entra con su cuenta del SIC.
 */

import { repartirCorreos } from "@/lib/negocios-verdes-correos";

type Fila = Record<string, unknown>;

export type Origen = {
  categorias_oficiales: Fila[];
  subcategorias: Fila[];
  actividades_productivas: Fila[];
  veredas: Fila[];
  negocios: Fila[];
  negocios_categorias: Fila[];
  negocios_subcategorias: Fila[];
  negocios_actividades: Fila[];
  negocio_fotos: Fila[];
  negocio_productos: Fila[];
  negocio_puntajes: Fila[];
  responsables_cdmb: Fila[];
  delegados: Fila[];
  representantes: Fila[];
  negocio_responsable: Fila[];
  negocio_delegado: Fila[];
  negocio_representante: Fila[];
  opciones_campo: Fila[];
  banners: Fila[];
  configuracion_sitio: Fila[];
  perfiles: Fila[];
};

export const TABLAS_ORIGEN = [
  "categorias_oficiales",
  "subcategorias",
  "actividades_productivas",
  "veredas",
  "negocios",
  "negocios_categorias",
  "negocios_subcategorias",
  "negocios_actividades",
  "negocio_fotos",
  "negocio_productos",
  "negocio_puntajes",
  "responsables_cdmb",
  "delegados",
  "representantes",
  "negocio_responsable",
  "negocio_delegado",
  "negocio_representante",
  "opciones_campo",
  "banners",
  "configuracion_sitio",
  "perfiles",
] as const satisfies readonly (keyof Origen)[];

/** Una imagen por copiar: de dónde se descarga y en qué ruta del almacén queda. */
export type ArchivoPorCopiar = { url: string; ruta: string };

const texto = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));
/** Si el origen trae dos correos en un campo, el segundo pasa al campo secundario. */
function dividirCorreos<P extends string, S extends string>(valor: string | null, principal: P, secundario: S) {
  const r = repartirCorreos(valor, null);
  return { [principal]: r.principal, [secundario]: r.secundario } as Record<P | S, string | null>;
}
const textoObligatorio = (v: unknown, campo: string): string => {
  const t = texto(v);
  if (t === null) throw new Error(`Falta ${campo}`);
  return t;
};
const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const entero = (v: unknown, defecto = 0): number => Math.trunc(numero(v) ?? defecto);
const booleano = (v: unknown, defecto = false): boolean => (v === null || v === undefined ? defecto : v === true || v === "t" || v === "true");
const fecha = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};
const fechaObligatoria = (v: unknown): Date => fecha(v) ?? new Date();

/**
 * Ruta en el almacén a partir de la URL pública del origen (…/storage/v1/object/public/<depósito>/<ruta>)
 * o, si no tiene esa forma, de la ruta guardada en la columna *_path con el depósito indicado.
 */
export function rutaAlmacen(url: unknown, ruta: unknown, deposito: string): string | null {
  const u = texto(url);
  if (u) {
    const m = /\/storage\/v1\/object\/(?:public|sign)\/([^/?#]+)\/([^?#]+)/.exec(u);
    if (m) return limpiarRuta(`${decodeURIComponent(m[1]!)}/${decodeURIComponent(m[2]!)}`);
  }
  const r = texto(ruta);
  return r ? limpiarRuta(`${deposito}/${r}`) : null;
}

function limpiarRuta(ruta: string): string | null {
  const partes = ruta.split("/").filter((p) => p && p !== ".");
  if (partes.length < 2 || partes.some((p) => p === "..")) return null;
  return partes.join("/");
}

/** Columnas de `negocios` que tienen campo propio en NvNegocio (o que no se traen). Lo demás va a fichaTecnica. */
const COLUMNAS_NEGOCIO_PROPIAS = new Set([
  "id",
  "nombre",
  "slug",
  "categoria_oficial_id",
  "municipio",
  "vereda_id",
  "direccion",
  "latitud",
  "longitud",
  "descripcion_corta",
  "descripcion",
  "producto",
  "telefono",
  "telefono_secundario",
  "whatsapp",
  "email",
  "sitio_web",
  "facebook_url",
  "instagram_url",
  "foto_portada_url",
  "foto_portada_path",
  "representante_legal",
  "emprendimiento_verde",
  "sello_marca",
  "avalado",
  "destacado",
  "activo",
  "created_at",
  "updated_at",
  "created_by",
  // Columna calculada de búsqueda del origen: en el SIC la búsqueda se hace sin ella.
  "busqueda",
]);

function valorFicha(v: unknown): ValorJson {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return JSON.parse(JSON.stringify(v)) as ValorJson;
}

type ValorJson = string | number | boolean | null | ValorJson[] | { [k: string]: ValorJson };

export function fichaTecnica(negocio: Fila): { [k: string]: ValorJson } {
  const ficha: { [k: string]: ValorJson } = {};
  for (const [k, v] of Object.entries(negocio)) {
    if (COLUMNAS_NEGOCIO_PROPIAS.has(k) || v === null || v === undefined || v === "") continue;
    ficha[k] = valorFicha(v);
  }
  return ficha;
}

const TIPO_PERSONA = {
  responsables_cdmb: "RESPONSABLE_CDMB",
  delegados: "DELEGADO",
  representantes: "REPRESENTANTE",
} as const;

const VINCULO_PERSONA = [
  { tabla: "negocio_responsable", columna: "responsable_id", tipo: "RESPONSABLE_CDMB" },
  { tabla: "negocio_delegado", columna: "delegado_id", tipo: "DELEGADO" },
  { tabla: "negocio_representante", columna: "representante_id", tipo: "REPRESENTANTE" },
] as const;

export function convertirOrigen(o: Origen) {
  const archivos = new Map<string, ArchivoPorCopiar>();
  const imagen = (url: unknown, ruta: unknown, deposito: string): string | null => {
    const destino = rutaAlmacen(url, ruta, deposito);
    const origen = texto(url);
    if (destino && origen && /^https?:\/\//i.test(origen)) archivos.set(destino, { url: origen, ruta: destino });
    return destino;
  };

  const categorias = o.categorias_oficiales.map((c) => ({
    id: textoObligatorio(c.id, "id de categoría"),
    nombre: textoObligatorio(c.nombre, "nombre de categoría"),
    slug: textoObligatorio(c.slug, "slug de categoría"),
    descripcion: texto(c.descripcion),
    icono: texto(c.icono),
    iconoRuta: imagen(c.icono_url, c.icono_path, "sitio-assets"),
    categoriaNacional: texto(c.categoria_nacional),
    orden: entero(c.orden),
    activo: booleano(c.activo, true),
    creadoEn: fechaObligatoria(c.created_at),
    actualizadoEn: fechaObligatoria(c.updated_at ?? c.created_at),
  }));

  const subcategorias = o.subcategorias.map((s) => ({
    id: textoObligatorio(s.id, "id de subcategoría"),
    categoriaId: textoObligatorio(s.categoria_oficial_id, "categoría de la subcategoría"),
    nombre: textoObligatorio(s.nombre, "nombre de subcategoría"),
    slug: textoObligatorio(s.slug, "slug de subcategoría"),
    icono: texto(s.icono),
    iconoRuta: imagen(s.icono_url, s.icono_path, "sitio-assets"),
    orden: entero(s.orden),
    activo: booleano(s.activo, true),
    creadoEn: fechaObligatoria(s.created_at),
    actualizadoEn: fechaObligatoria(s.updated_at ?? s.created_at),
  }));

  const actividades = o.actividades_productivas.map((a) => ({
    id: textoObligatorio(a.id, "id de actividad"),
    subcategoriaId: textoObligatorio(a.subcategoria_id, "subcategoría de la actividad"),
    nombre: textoObligatorio(a.nombre, "nombre de actividad"),
    slug: textoObligatorio(a.slug, "slug de actividad"),
    descripcion: texto(a.descripcion),
    icono: texto(a.icono),
    iconoRuta: imagen(a.icono_url, a.icono_path, "sitio-assets"),
    orden: entero(a.orden),
    activo: booleano(a.activo, true),
    creadoEn: fechaObligatoria(a.created_at),
    actualizadoEn: fechaObligatoria(a.updated_at ?? a.created_at),
  }));

  const veredas = o.veredas.map((v) => ({
    id: textoObligatorio(v.id, "id de vereda"),
    municipio: textoObligatorio(v.municipio, "municipio de la vereda"),
    nombre: textoObligatorio(v.nombre, "nombre de vereda"),
    slug: textoObligatorio(v.slug, "slug de vereda"),
    activo: booleano(v.activo, true),
    creadoEn: fechaObligatoria(v.created_at),
    actualizadoEn: fechaObligatoria(v.updated_at ?? v.created_at),
  }));

  const negocios = o.negocios.map((n) => ({
    id: textoObligatorio(n.id, "id de negocio"),
    nombre: textoObligatorio(n.nombre, "nombre de negocio"),
    slug: textoObligatorio(n.slug, "slug de negocio"),
    categoriaId: textoObligatorio(n.categoria_oficial_id, "categoría del negocio"),
    municipio: textoObligatorio(n.municipio, "municipio del negocio"),
    veredaId: texto(n.vereda_id),
    direccion: texto(n.direccion),
    latitud: numero(n.latitud),
    longitud: numero(n.longitud),
    descripcionCorta: texto(n.descripcion_corta),
    descripcion: texto(n.descripcion),
    producto: texto(n.producto),
    telefono: texto(n.telefono),
    telefonoSecundario: texto(n.telefono_secundario),
    whatsapp: texto(n.whatsapp),
    ...dividirCorreos(texto(n.email), "email", "emailSecundario"),
    sitioWeb: texto(n.sitio_web),
    facebookUrl: texto(n.facebook_url),
    instagramUrl: texto(n.instagram_url),
    fotoPortadaRuta: imagen(n.foto_portada_url, n.foto_portada_path, "negocios-fotos"),
    representanteLegal: texto(n.representante_legal),
    emprendimientoVerde: booleano(n.emprendimiento_verde),
    selloMarca: booleano(n.sello_marca),
    avalado: booleano(n.avalado),
    destacado: booleano(n.destacado),
    activo: booleano(n.activo),
    fichaTecnica: fichaTecnica(n),
    creadoEn: fechaObligatoria(n.created_at),
    actualizadoEn: fechaObligatoria(n.updated_at ?? n.created_at),
  }));

  const negocioCategorias = o.negocios_categorias.map((x) => ({ negocioId: String(x.negocio_id), categoriaId: String(x.categoria_oficial_id) }));
  const negocioSubcategorias = o.negocios_subcategorias.map((x) => ({ negocioId: String(x.negocio_id), subcategoriaId: String(x.subcategoria_id) }));
  const negocioActividades = o.negocios_actividades.map((x) => ({ negocioId: String(x.negocio_id), actividadId: String(x.actividad_productiva_id) }));

  const fotos = o.negocio_fotos
    .map((f) => ({
      id: textoObligatorio(f.id, "id de foto"),
      negocioId: textoObligatorio(f.negocio_id, "negocio de la foto"),
      ruta: imagen(f.url, f.storage_path, "negocios-fotos"),
      orden: entero(f.orden),
      creadoEn: fechaObligatoria(f.created_at),
    }))
    .filter((f): f is typeof f & { ruta: string } => f.ruta !== null);

  const productos = o.negocio_productos.map((p) => ({
    id: textoObligatorio(p.id, "id de producto"),
    negocioId: textoObligatorio(p.negocio_id, "negocio del producto"),
    orden: entero(p.orden),
    nombre: texto(p.nombre),
    fotoRuta: imagen(p.foto_url, p.foto_storage_path, "negocios-fotos"),
    descripcion: texto(p.descripcion),
    creadoEn: fechaObligatoria(p.created_at),
  }));

  const puntajes = o.negocio_puntajes.map((p) => ({
    negocioId: textoObligatorio(p.negocio_id, "negocio del puntaje"),
    anio: entero(p.anio),
    puntaje: String(numero(p.puntaje) ?? 0),
  }));

  const personas = (Object.keys(TIPO_PERSONA) as (keyof typeof TIPO_PERSONA)[]).flatMap((tabla) =>
    o[tabla].map((p) => ({
      id: textoObligatorio(p.id, "id de persona"),
      tipo: TIPO_PERSONA[tabla],
      nombres: textoObligatorio(p.nombres, "nombres de la persona"),
      apellidos: texto(p.apellidos),
      tipoDocumento: texto(p.tipo_documento),
      documento: texto(p.documento),
      telefono: texto(p.telefono),
      ...dividirCorreos(texto(p.correo), "correo", "correoSecundario"),
      cargo: texto(p.cargo),
      direccion: texto(p.direccion),
      municipio: texto(p.municipio),
      naturalezaJuridica: texto(p.naturaleza_juridica),
      activo: booleano(p.activo, true),
      creadoEn: fechaObligatoria(p.created_at),
      actualizadoEn: fecha(p.updated_at),
    }))
  );

  const vinculos = VINCULO_PERSONA.flatMap(({ tabla, columna, tipo }) =>
    o[tabla].map((v) => ({
      id: textoObligatorio(v.id, "id del vínculo"),
      negocioId: textoObligatorio(v.negocio_id, "negocio del vínculo"),
      personaId: textoObligatorio(v[columna], "persona del vínculo"),
      tipo,
      nit: texto(v.nit),
      naturalezaJuridica: texto(v.naturaleza_juridica),
      vigenteDesde: fechaObligatoria(v.vigente_desde),
      vigenteHasta: fecha(v.vigente_hasta),
      nota: texto(v.nota),
      creadoEn: fechaObligatoria(v.created_at),
    }))
  );

  const opciones = o.opciones_campo.map((x) => ({
    id: textoObligatorio(x.id, "id de opción"),
    campo: textoObligatorio(x.campo, "campo de la opción"),
    valor: textoObligatorio(x.valor, "valor de la opción"),
    orden: entero(x.orden),
    creadoEn: fechaObligatoria(x.created_at),
  }));

  const banners = o.banners
    .map((b) => ({
      id: textoObligatorio(b.id, "id de banner"),
      imagenRuta: imagen(b.imagen_url, b.imagen_path, "sitio-assets"),
      urlDestino: texto(b.url_destino),
      abrirEnPestanaNueva: booleano(b.abrir_en_pestana_nueva, true),
      orden: entero(b.orden),
      activo: booleano(b.activo, true),
      creadoEn: fechaObligatoria(b.created_at),
      actualizadoEn: fechaObligatoria(b.updated_at ?? b.created_at),
    }))
    .filter((b): b is typeof b & { imagenRuta: string } => b.imagenRuta !== null);

  const c = o.configuracion_sitio[0];
  const configuracion = c
    ? {
        id: "singleton",
        logoRuta: imagen(c.logo_url, c.logo_path, "sitio-assets"),
        logoGovcoRuta: imagen(c.logo_govco_url, c.logo_govco_path, "sitio-assets"),
        logoColombiaRuta: imagen(c.logo_colombia_url, c.logo_colombia_path, "sitio-assets"),
        logoPotenciaRuta: imagen(c.logo_potencia_url, c.logo_potencia_path, "sitio-assets"),
      }
    : null;

  /** Administradores del origen: se asocian por correo a su usuario del SIC (no se traen contraseñas). */
  const administradores = o.perfiles
    .filter((p) => booleano(p.is_admin) && booleano(p.activo, true) && texto(p.email))
    .map((p) => ({ correo: String(p.email).trim().toLowerCase(), superAdmin: booleano(p.es_super_admin), nombre: texto(p.nombre) }));

  return {
    categorias,
    subcategorias,
    actividades,
    veredas,
    negocios,
    negocioCategorias,
    negocioSubcategorias,
    negocioActividades,
    fotos,
    productos,
    puntajes,
    personas,
    vinculos,
    opciones,
    banners,
    configuracion,
    administradores,
    archivos: [...archivos.values()],
  };
}

export type Convertido = ReturnType<typeof convertirOrigen>;

/** Conteo por tabla de origen y su destino, para el informe de antes y después. */
export function conteos(o: Origen, c: Convertido) {
  return [
    { origen: "categorias_oficiales", filas: o.categorias_oficiales.length, destino: "NvCategoria", convertidas: c.categorias.length },
    { origen: "subcategorias", filas: o.subcategorias.length, destino: "NvSubcategoria", convertidas: c.subcategorias.length },
    { origen: "actividades_productivas", filas: o.actividades_productivas.length, destino: "NvActividad", convertidas: c.actividades.length },
    { origen: "veredas", filas: o.veredas.length, destino: "NvVereda", convertidas: c.veredas.length },
    { origen: "negocios", filas: o.negocios.length, destino: "NvNegocio", convertidas: c.negocios.length },
    { origen: "negocios_categorias", filas: o.negocios_categorias.length, destino: "NvNegocioCategoria", convertidas: c.negocioCategorias.length },
    { origen: "negocios_subcategorias", filas: o.negocios_subcategorias.length, destino: "NvNegocioSubcategoria", convertidas: c.negocioSubcategorias.length },
    { origen: "negocios_actividades", filas: o.negocios_actividades.length, destino: "NvNegocioActividad", convertidas: c.negocioActividades.length },
    { origen: "negocio_fotos", filas: o.negocio_fotos.length, destino: "NvNegocioFoto", convertidas: c.fotos.length },
    { origen: "negocio_productos", filas: o.negocio_productos.length, destino: "NvNegocioProducto", convertidas: c.productos.length },
    { origen: "negocio_puntajes", filas: o.negocio_puntajes.length, destino: "NvNegocioPuntaje", convertidas: c.puntajes.length },
    {
      origen: "responsables_cdmb + delegados + representantes",
      filas: o.responsables_cdmb.length + o.delegados.length + o.representantes.length,
      destino: "NvPersona",
      convertidas: c.personas.length,
    },
    {
      origen: "negocio_responsable + negocio_delegado + negocio_representante",
      filas: o.negocio_responsable.length + o.negocio_delegado.length + o.negocio_representante.length,
      destino: "NvNegocioPersona",
      convertidas: c.vinculos.length,
    },
    { origen: "opciones_campo", filas: o.opciones_campo.length, destino: "NvOpcionCampo", convertidas: c.opciones.length },
    { origen: "banners", filas: o.banners.length, destino: "NvBanner", convertidas: c.banners.length },
    { origen: "configuracion_sitio", filas: o.configuracion_sitio.length, destino: "NvConfiguracion", convertidas: c.configuracion ? 1 : 0 },
  ];
}
