import { NextRequest, NextResponse } from "next/server";
import type { ModalidadSeleccion } from "@prisma/client";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarContratacion } from "@/lib/permisos";
import { actualizarRequisitoCatalogo, moverRequisitoCatalogo, eliminarRequisitoCatalogo } from "@/lib/contratacion";

/** Actualiza un requisito del catálogo (nombre/código/fuente/obligatorio/activo) o lo reordena
 * (`{ "direccion": "arriba" | "abajo" }`) dentro de su grupo (misma etapa y modalidad). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarContratacion(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para modificar el catálogo de requisitos." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  try {
    if (body.direccion === "arriba" || body.direccion === "abajo") {
      await moverRequisitoCatalogo(id, body.direccion);
      return NextResponse.json({ ok: true });
    }

    const datos: Parameters<typeof actualizarRequisitoCatalogo>[1] = {};
    if (typeof body.nombre === "string") datos.nombre = body.nombre;
    if ("codigoFormato" in body) datos.codigoFormato = body.codigoFormato ? String(body.codigoFormato).trim() : null;
    if ("fuente" in body) datos.fuente = body.fuente ? String(body.fuente).trim() : null;
    if ("notaOrigenExterno" in body) datos.notaOrigenExterno = body.notaOrigenExterno ? String(body.notaOrigenExterno).trim() : null;
    if ("modalidadSeleccion" in body) datos.modalidadSeleccion = body.modalidadSeleccion ? (String(body.modalidadSeleccion) as ModalidadSeleccion) : null;
    if (typeof body.obligatorio === "boolean") datos.obligatorio = body.obligatorio;
    if (typeof body.gestionadoEnSecop === "boolean") datos.gestionadoEnSecop = body.gestionadoEnSecop;
    if (typeof body.activo === "boolean") datos.activo = body.activo;

    await actualizarRequisitoCatalogo(id, datos);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo actualizar el requisito." }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarContratacion(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para modificar el catálogo de requisitos." }, { status: 403 });
  }

  try {
    await eliminarRequisitoCatalogo(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo eliminar el requisito." }, { status: 400 });
  }
}
