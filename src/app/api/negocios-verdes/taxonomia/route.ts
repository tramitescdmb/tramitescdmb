import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditarNV, exigirPermisoNV } from "@/lib/negocios-verdes-api";
import { validarTaxon } from "@/lib/negocios-verdes-catalogo";
import { refrescarSitioNV } from "@/lib/negocios-verdes-admin";

const NOMBRE = { categoria: "categoría", subcategoria: "subcategoría", actividad: "actividad productiva" } as const;

/** Crea o edita una categoría, subcategoría o actividad productiva (perfil de configuración). */
export async function POST(req: NextRequest) {
  const acceso = await exigirPermisoNV("CONFIGURAR");
  if ("error" in acceso) return acceso.error;
  const body = await req.json().catch(() => ({}));
  const { datos, errores } = validarTaxon(body);
  if (!datos) return NextResponse.json({ error: errores.join(" ") }, { status: 400 });
  const id = typeof body.id === "string" && body.id ? body.id : null;
  const comun = { nombre: datos.nombre, slug: datos.slug, icono: datos.icono, orden: datos.orden, activo: datos.activo };
  try {
    let r: { id: string };
    if (datos.nivel === "categoria") {
      const data = { ...comun, descripcion: datos.descripcion, categoriaNacional: datos.categoriaNacional };
      r = id ? await db.nvCategoria.update({ where: { id }, data }) : await db.nvCategoria.create({ data });
    } else if (datos.nivel === "subcategoria") {
      const data = { ...comun, categoriaId: datos.padreId! };
      r = id ? await db.nvSubcategoria.update({ where: { id }, data }) : await db.nvSubcategoria.create({ data });
    } else {
      const data = { ...comun, descripcion: datos.descripcion, subcategoriaId: datos.padreId! };
      r = id ? await db.nvActividad.update({ where: { id }, data }) : await db.nvActividad.create({ data });
    }
    await auditarNV({ entidad: "NvTaxonomia", entidadId: r.id, accion: id ? "MODIFICA" : "CREA", usuarioId: acceso.session.userId, detalle: `${acceso.session.nombre} ${id ? "editó" : "creó"} la ${NOMBRE[datos.nivel]} «${datos.nombre}»${datos.activo ? "" : " (inactiva)"}` });
    refrescarSitioNV();
    return NextResponse.json({ id: r.id });
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    if (codigo === "P2002") return NextResponse.json({ error: `Ya existe otra con la dirección «${datos.slug}».` }, { status: 409 });
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 400 });
  }
}

/** Elimina solo si nadie la usa; si está en uso, se sugiere desactivarla. */
export async function DELETE(req: NextRequest) {
  const acceso = await exigirPermisoNV("CONFIGURAR");
  if ("error" in acceso) return acceso.error;
  const nivel = req.nextUrl.searchParams.get("nivel");
  const id = req.nextUrl.searchParams.get("id") ?? "";
  try {
    const r =
      nivel === "categoria"
        ? await db.nvCategoria.delete({ where: { id }, select: { nombre: true } })
        : nivel === "subcategoria"
          ? await db.$transaction(async (tx) => {
              if (await tx.nvNegocioSubcategoria.count({ where: { subcategoriaId: id } })) throw Object.assign(new Error(), { code: "P2003" });
              return tx.nvSubcategoria.delete({ where: { id }, select: { nombre: true } });
            })
          : nivel === "actividad"
            ? await db.nvActividad.delete({ where: { id }, select: { nombre: true } })
            : null;
    if (!r) return NextResponse.json({ error: "Nivel no válido." }, { status: 400 });
    await auditarNV({ entidad: "NvTaxonomia", entidadId: id, accion: "ELIMINA", usuarioId: acceso.session.userId, detalle: `${acceso.session.nombre} eliminó «${r.nombre}» de la clasificación` });
    refrescarSitioNV();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    if (codigo === "P2003" || codigo === "P2014") return NextResponse.json({ error: "Está en uso por negocios o por otros niveles. Desactívela en lugar de eliminarla." }, { status: 409 });
    return NextResponse.json({ error: "No se pudo eliminar." }, { status: 400 });
  }
}
