import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas, puedeEliminarExpedienteContractual } from "@/lib/permisos";
import { eliminarExpedienteContractualCompleto, registrarEventoContratacion } from "@/lib/contratacion";
import { deleteDocumento } from "@/lib/storage";

/** Vincula el contratista (o el expediente relacionado) a un expediente ya creado — Administrador
 * o Jefe de Contratación. Punto de extensión para futuros campos editables del expediente (objeto,
 * valor, fechas) si hiciera falta más adelante. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarContratistas(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para editar este expediente." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  if ("contratistaId" in body) {
    const contratistaId = String(body.contratistaId || "").trim();
    if (!contratistaId) return NextResponse.json({ error: "Falta el contratista." }, { status: 400 });
    const contratista = await db.contratista.findUnique({ where: { id: contratistaId }, select: { nombreORazonSocial: true } });
    if (!contratista) return NextResponse.json({ error: "El contratista no existe." }, { status: 404 });

    await db.expedienteContractual.update({ where: { id }, data: { contratistaId } });
    await registrarEventoContratacion(id, "CONTRATISTA_VINCULADO", `Se vinculó a ${contratista.nombreORazonSocial} como contratista.`, session.userId);
    return NextResponse.json({ ok: true });
  }

  if ("supervisorUsuarioIds" in body) {
    const idsBody: unknown = body.supervisorUsuarioIds;
    const supervisorUsuarioIds = Array.isArray(idsBody) ? [...new Set(idsBody.filter((v): v is string => typeof v === "string" && v.trim() !== ""))] : [];
    if (supervisorUsuarioIds.length > 0) {
      const usuarios = await db.usuario.findMany({ where: { id: { in: supervisorUsuarioIds }, activo: true }, select: { id: true } });
      if (usuarios.length !== supervisorUsuarioIds.length) {
        return NextResponse.json({ error: "Alguno de los usuarios elegidos no existe o está inactivo." }, { status: 400 });
      }
    }
    await db.$transaction([
      db.expedienteContractualSupervisor.deleteMany({ where: { expedienteId: id } }),
      ...(supervisorUsuarioIds.length > 0
        ? [db.expedienteContractualSupervisor.createMany({ data: supervisorUsuarioIds.map((usuarioId) => ({ expedienteId: id, usuarioId })) })]
        : []),
    ]);
    await registrarEventoContratacion(id, "SUPERVISORES_ACTUALIZADOS", `Se actualizó la lista de supervisor(es)/interventor(es) (${supervisorUsuarioIds.length}).`, session.userId);
    return NextResponse.json({ ok: true });
  }

  if ("expedienteRelacionadoId" in body) {
    const expedienteRelacionadoId = body.expedienteRelacionadoId ? String(body.expedienteRelacionadoId).trim() : null;
    if (expedienteRelacionadoId === id) return NextResponse.json({ error: "Un expediente no puede relacionarse consigo mismo." }, { status: 400 });
    let relacionado: { numero: string } | null = null;
    if (expedienteRelacionadoId) {
      relacionado = await db.expedienteContractual.findUnique({ where: { id: expedienteRelacionadoId }, select: { numero: true } });
      if (!relacionado) return NextResponse.json({ error: "El expediente relacionado no existe." }, { status: 404 });
    }
    await db.expedienteContractual.update({ where: { id }, data: { expedienteRelacionadoId } });
    await registrarEventoContratacion(
      id,
      "EXPEDIENTE_RELACIONADO",
      relacionado ? `Se vinculó como relacionado el expediente ${relacionado.numero}.` : "Se quitó la vinculación con otro expediente.",
      session.userId
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });
}

/** Elimina COMPLETAMENTE un expediente contractual, incluso cerrado — decisión explícita
 * del usuario, más severa que la excepción de borrado de un solo documento. Reservado al
 * Administrador de Contratación. Los archivos del storage se borran best-effort. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeEliminarExpedienteContractual(permisos)) {
    return NextResponse.json({ error: "Solo el Administrador de Contratación puede eliminar un expediente." }, { status: 403 });
  }

  try {
    const { storagePaths } = await eliminarExpedienteContractualCompleto(id);
    await Promise.all(storagePaths.map((p) => deleteDocumento(p).catch(() => {})));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo eliminar el expediente." }, { status: 400 });
  }
}
