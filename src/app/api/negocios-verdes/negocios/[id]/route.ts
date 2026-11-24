import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditarNV, exigirPermisoNV } from "@/lib/negocios-verdes-api";
import { limpiarFicha, validarNegocio } from "@/lib/negocios-verdes-ficha";
import { eliminarNegocioNV, guardarNegocioNV, imagenesDeNegocio, refrescarSitioNV, slugDisponible } from "@/lib/negocios-verdes-admin";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const acceso = await exigirPermisoNV("ACTUALIZAR");
  if ("error" in acceso) return acceso.error;
  const { id } = await params;
  const actual = await db.nvNegocio.findUnique({ where: { id }, select: { id: true, activo: true, fichaTecnica: true, actualizadoEn: true } });
  if (!actual) return NextResponse.json({ error: "El negocio ya no existe." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  // Dos personas editando el mismo negocio: la segunda que guarda no pisa sin saberlo.
  if (typeof body.actualizadoEn === "string" && body.actualizadoEn !== actual.actualizadoEn.toISOString()) {
    return NextResponse.json({ error: "Otra persona modificó este negocio mientras usted lo editaba. Recargue la página para ver los cambios." }, { status: 409 });
  }
  const { datos, errores } = validarNegocio(body, { negocioId: id, imagenesAnteriores: await imagenesDeNegocio(id) });
  const ficha = limpiarFicha(body.fichaTecnica, (actual.fichaTecnica ?? {}) as Record<string, unknown>);
  if (!datos || errores.length > 0 || ficha.errores.length > 0) return NextResponse.json({ error: [...errores, ...ficha.errores].join(" ") }, { status: 400 });
  if (!(await slugDisponible(datos.slug, id))) return NextResponse.json({ error: `Ya hay otro negocio con la dirección «${datos.slug}».` }, { status: 409 });
  try {
    const n = await guardarNegocioNV(id, datos, ficha.ficha, acceso.session.userId);
    const cambioPublicacion = actual.activo !== n.activo ? (n.activo ? " y lo publicó" : " y lo retiró del sitio público") : "";
    await auditarNV({ entidad: "NvNegocio", entidadId: id, accion: "MODIFICA", usuarioId: acceso.session.userId, detalle: `${acceso.session.nombre} editó el negocio verde «${n.nombre}»${cambioPublicacion}` });
    return NextResponse.json({ id, actualizadoEn: n.actualizadoEn.toISOString() });
  } catch (e) {
    console.error("[negocios-verdes] editar", e);
    return NextResponse.json({ error: "No se pudo guardar. Revise que la categoría, subcategorías y vereda sigan existiendo." }, { status: 400 });
  }
}

/**
 * Cambio rápido desde el listado (interruptor «publicado» y estrella «destacado»), como en la
 * plataforma anterior. No toca el resto de la ficha.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const acceso = await exigirPermisoNV("ACTUALIZAR");
  if ("error" in acceso) return acceso.error;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { activo?: unknown; destacado?: unknown };
  const cambio: { activo?: boolean; destacado?: boolean } = {};
  if (typeof body.activo === "boolean") cambio.activo = body.activo;
  if (typeof body.destacado === "boolean") cambio.destacado = body.destacado;
  if (!Object.keys(cambio).length) return NextResponse.json({ error: "No hay nada que cambiar." }, { status: 400 });
  const n = await db.nvNegocio.update({ where: { id }, data: cambio, select: { nombre: true, activo: true, destacado: true } }).catch(() => null);
  if (!n) return NextResponse.json({ error: "El negocio ya no existe." }, { status: 404 });
  const que = "activo" in cambio ? (n.activo ? "publicó" : "retiró del sitio público") : n.destacado ? "marcó como destacado" : "quitó de destacados";
  await auditarNV({ entidad: "NvNegocio", entidadId: id, accion: "MODIFICA", usuarioId: acceso.session.userId, detalle: `${acceso.session.nombre} ${que} el negocio verde «${n.nombre}»` });
  refrescarSitioNV();
  return NextResponse.json({ activo: n.activo, destacado: n.destacado });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const acceso = await exigirPermisoNV("ELIMINAR");
  if ("error" in acceso) return acceso.error;
  const { id } = await params;
  try {
    const n = await eliminarNegocioNV(id);
    await auditarNV({ entidad: "NvNegocio", entidadId: id, accion: "ELIMINA", usuarioId: acceso.session.userId, detalle: `${acceso.session.nombre} eliminó el negocio verde «${n.nombre}» y sus fotos` });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "El negocio ya no existe." }, { status: 404 });
  }
}
