import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas, tieneRolContratacion } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";
import { editarContratistaMinimo } from "@/lib/contratacion";

async function puedeEditarEsteContratista(permisos: Awaited<ReturnType<typeof obtenerPermisosUsuario>>, contratistaId: string): Promise<boolean> {
  if (puedeGestionarContratistas(permisos)) return true;
  if (!tieneRolContratacion(permisos, "FUNCIONARIO_CONTRATACION") || permisos.asignadoExpedientes.size === 0) return false;
  const vinculado = await db.contratista.findFirst({
    where: { id: contratistaId, expedientes: { some: { id: { in: [...permisos.asignadoExpedientes] } } } },
    select: { id: true },
  });
  return Boolean(vinculado);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!(await puedeEditarEsteContratista(permisos, id))) {
    return NextResponse.json({ error: "No tiene permiso para editar este contratista." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  try {
    await editarContratistaMinimo(id, body.persona, body.representanteLegal);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo editar el contratista." }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarContratistas(permisos)) {
    return NextResponse.json({ error: "No tiene permiso." }, { status: 403 });
  }

  const contratista = await db.contratista.findUnique({
    where: { id },
    select: { identificacion: true, nombreORazonSocial: true, _count: { select: { expedientes: true } } },
  });
  if (!contratista) return NextResponse.json({ error: "Contratista no encontrado." }, { status: 404 });
  if (contratista._count.expedientes > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: pertenece a ${contratista._count.expedientes} expediente(s). Reasígnelos a otro contratista o elimine esos expedientes primero.` },
      { status: 409 }
    );
  }

  const { count } = await db.contratista.deleteMany({ where: { id, expedientes: { none: {} } } });
  if (count === 0) return NextResponse.json({ error: "El contratista acaba de quedar asociado a un expediente; no se eliminó." }, { status: 409 });

  await registrarAuditoria({
    tipo: "CONTRATISTA_ELIMINADO",
    descripcion: `Se eliminó el contratista ${contratista.nombreORazonSocial} (${contratista.identificacion}), que no tenía expedientes.`,
    usuarioId: session.userId,
  });
  return NextResponse.json({ ok: true });
}
