import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";

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
