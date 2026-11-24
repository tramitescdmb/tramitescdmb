import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { eliminar, limpiarCarpetasVacias } from "@/lib/almacen";
import { BUCKET_NEGOCIOS_VERDES, urlImagenNV } from "@/lib/negocios-verdes";
import { ETIQUETA_CACHE_NV } from "@/lib/negocios-verdes-data";
import type { NegocioValidado, ValorFicha } from "@/lib/negocios-verdes-ficha";

export function refrescarSitioNV() {
  revalidateTag(ETIQUETA_CACHE_NV, { expire: 0 });
}

/** Catálogos para el formulario del negocio. */
export async function catalogosFormularioNV() {
  const [categorias, subcategorias, actividades, veredas, opciones] = await Promise.all([
    db.nvCategoria.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true, icono: true, activo: true } }),
    db.nvSubcategoria.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true, categoriaId: true, activo: true } }),
    db.nvActividad.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true, subcategoriaId: true, activo: true } }),
    db.nvVereda.findMany({ where: { activo: true }, orderBy: [{ municipio: "asc" }, { nombre: "asc" }], select: { id: true, nombre: true, municipio: true } }),
    db.nvOpcionCampo.findMany({ orderBy: [{ campo: "asc" }, { orden: "asc" }, { valor: "asc" }], select: { campo: true, valor: true } }),
  ]);
  const opcionesPorCampo: Record<string, string[]> = {};
  for (const o of opciones) (opcionesPorCampo[o.campo] ??= []).push(o.valor);
  return { categorias, subcategorias, actividades, veredas, opcionesPorCampo };
}
export type CatalogosFormularioNV = Awaited<ReturnType<typeof catalogosFormularioNV>>;

/** Negocio completo para editar (incluye lo interno: ficha técnica y puntajes). */
export async function negocioParaEditar(id: string) {
  const n = await db.nvNegocio.findUnique({
    where: { id },
    include: {
      categorias: { select: { categoriaId: true } },
      subcategorias: { select: { subcategoriaId: true } },
      actividades: { select: { actividadId: true } },
      fotos: { orderBy: { orden: "asc" }, select: { ruta: true } },
      productos: { orderBy: { orden: "asc" }, select: { orden: true, nombre: true, descripcion: true, fotoRuta: true } },
      puntajes: { orderBy: { anio: "asc" }, select: { anio: true, puntaje: true } },
    },
  });
  if (!n) return null;
  return {
    id: n.id,
    nombre: n.nombre,
    slug: n.slug,
    municipio: n.municipio,
    veredaId: n.veredaId,
    direccion: n.direccion,
    latitud: n.latitud,
    longitud: n.longitud,
    descripcionCorta: n.descripcionCorta,
    descripcion: n.descripcion,
    producto: n.producto,
    telefono: n.telefono,
    telefonoSecundario: n.telefonoSecundario,
    whatsapp: n.whatsapp,
    email: n.email,
    sitioWeb: n.sitioWeb,
    facebookUrl: n.facebookUrl,
    instagramUrl: n.instagramUrl,
    representanteLegal: n.representanteLegal,
    emprendimientoVerde: n.emprendimientoVerde,
    selloMarca: n.selloMarca,
    avalado: n.avalado,
    destacado: n.destacado,
    activo: n.activo,
    categoriaId: n.categoriaId,
    categoriaIds: n.categorias.map((c) => c.categoriaId),
    subcategoriaIds: n.subcategorias.map((s) => s.subcategoriaId),
    actividadIds: n.actividades.map((a) => a.actividadId),
    fotoPortadaRuta: n.fotoPortadaRuta,
    fotoPortadaUrl: urlImagenNV(n.fotoPortadaRuta),
    fotos: n.fotos.map((f) => ({ ruta: f.ruta, url: urlImagenNV(f.ruta) })),
    productos: n.productos.map((p) => ({ ...p, fotoUrl: urlImagenNV(p.fotoRuta) })),
    puntajes: n.puntajes.map((p) => ({ anio: p.anio, puntaje: Number(p.puntaje) })),
    fichaTecnica: (n.fichaTecnica ?? {}) as Record<string, unknown>,
    actualizadoEn: n.actualizadoEn.toISOString(),
  };
}
export type NegocioEditable = NonNullable<Awaited<ReturnType<typeof negocioParaEditar>>>;

/** Rutas de imagen que usa hoy un negocio (para aceptar las que ya tenía y borrar las que se quitan). */
export async function imagenesDeNegocio(id: string): Promise<Set<string>> {
  const n = await db.nvNegocio.findUnique({
    where: { id },
    select: { fotoPortadaRuta: true, fotos: { select: { ruta: true } }, productos: { select: { fotoRuta: true } } },
  });
  if (!n) return new Set();
  return new Set([n.fotoPortadaRuta, ...n.fotos.map((f) => f.ruta), ...n.productos.map((p) => p.fotoRuta)].filter((r): r is string => Boolean(r)));
}

export async function slugDisponible(slug: string, excepto: string | null): Promise<boolean> {
  const otro = await db.nvNegocio.findUnique({ where: { slug }, select: { id: true } });
  return !otro || otro.id === excepto;
}

/** Crea o actualiza un negocio con sus tablas puente, fotos y productos en una sola transacción. */
export async function guardarNegocioNV(id: string | null, d: NegocioValidado, ficha: Record<string, ValorFicha>, usuarioId: string) {
  const anteriores = id ? await imagenesDeNegocio(id) : new Set<string>();
  const base = {
    nombre: d.nombre,
    slug: d.slug,
    municipio: d.municipio,
    veredaId: d.veredaId,
    direccion: d.direccion,
    latitud: d.latitud,
    longitud: d.longitud,
    descripcionCorta: d.descripcionCorta,
    descripcion: d.descripcion,
    producto: d.producto,
    telefono: d.telefono,
    telefonoSecundario: d.telefonoSecundario,
    whatsapp: d.whatsapp,
    email: d.email,
    sitioWeb: d.sitioWeb,
    facebookUrl: d.facebookUrl,
    instagramUrl: d.instagramUrl,
    representanteLegal: d.representanteLegal,
    emprendimientoVerde: d.emprendimientoVerde,
    selloMarca: d.selloMarca,
    avalado: d.avalado,
    destacado: d.destacado,
    activo: d.activo,
    categoriaId: d.categoriaId,
    fotoPortadaRuta: d.fotoPortadaRuta,
    fichaTecnica: ficha,
  };
  const negocio = await db.$transaction(async (tx) => {
    const n = id ? await tx.nvNegocio.update({ where: { id }, data: base }) : await tx.nvNegocio.create({ data: { ...base, creadoPorId: usuarioId } });
    await tx.nvNegocioCategoria.deleteMany({ where: { negocioId: n.id } });
    await tx.nvNegocioSubcategoria.deleteMany({ where: { negocioId: n.id } });
    await tx.nvNegocioActividad.deleteMany({ where: { negocioId: n.id } });
    await tx.nvNegocioFoto.deleteMany({ where: { negocioId: n.id } });
    await tx.nvNegocioProducto.deleteMany({ where: { negocioId: n.id } });
    await tx.nvNegocioCategoria.createMany({ data: d.categoriaIds.map((categoriaId) => ({ negocioId: n.id, categoriaId })) });
    await tx.nvNegocioSubcategoria.createMany({ data: d.subcategoriaIds.map((subcategoriaId) => ({ negocioId: n.id, subcategoriaId })) });
    await tx.nvNegocioActividad.createMany({ data: d.actividadIds.map((actividadId) => ({ negocioId: n.id, actividadId })) });
    await tx.nvNegocioFoto.createMany({ data: d.fotos.map((ruta, orden) => ({ negocioId: n.id, ruta, orden })) });
    await tx.nvNegocioProducto.createMany({ data: d.productos.map((p) => ({ ...p, negocioId: n.id })) });
    return n;
  });
  // Imágenes que se quitaron: se borran del NAS (después de confirmar la transacción).
  const usadas = new Set([d.fotoPortadaRuta, ...d.fotos, ...d.productos.map((p) => p.fotoRuta)].filter(Boolean));
  const quitadas = [...anteriores].filter((r) => !usadas.has(r));
  if (quitadas.length > 0) await eliminar(BUCKET_NEGOCIOS_VERDES, quitadas).catch(() => {});
  refrescarSitioNV();
  return negocio;
}

export async function eliminarNegocioNV(id: string) {
  const imagenes = await imagenesDeNegocio(id);
  const n = await db.nvNegocio.delete({ where: { id }, select: { nombre: true } });
  if (imagenes.size > 0) await eliminar(BUCKET_NEGOCIOS_VERDES, [...imagenes]).catch(() => {});
  await limpiarCarpetasVacias(BUCKET_NEGOCIOS_VERDES, `negocios-fotos/${id}`).catch(() => {});
  refrescarSitioNV();
  return n;
}

export async function guardarPuntajesNV(negocioId: string, puntajes: { anio: number; puntaje: number }[]) {
  await db.$transaction([
    db.nvNegocioPuntaje.deleteMany({ where: { negocioId } }),
    db.nvNegocioPuntaje.createMany({ data: puntajes.map((p) => ({ negocioId, anio: p.anio, puntaje: p.puntaje.toFixed(2) })) }),
  ]);
}
