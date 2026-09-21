import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas } from "@/lib/permisos";
import { esRegimenTributario } from "@/lib/regimen-tributario";
import { registrarAuditoria } from "@/lib/auditoria";

/** Edita el registro maestro de un Contratista — Administrador o Jefe de Contratación. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarContratistas(permisos)) {
    return NextResponse.json({ error: "No tiene permiso." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const nombreORazonSocial = String(body.nombreORazonSocial || "").trim();
  if (!nombreORazonSocial) return NextResponse.json({ error: "El nombre o razón social no puede quedar vacío." }, { status: 400 });

  const regimenTributario = body.regimenTributario || null;
  if (regimenTributario && !esRegimenTributario(regimenTributario)) {
    return NextResponse.json({ error: "El régimen tributario indicado no es válido." }, { status: 400 });
  }

  const actualizado = await db.contratista
    .update({
      where: { id },
      data: {
        nombreORazonSocial,
        nombres: String(body.nombres || "").trim() || null,
        apellidos: String(body.apellidos || "").trim() || null,
        regimenTributario,
        granContribuyente: Boolean(body.granContribuyente),
        contactoEmail: String(body.contactoEmail || "").trim() || null,
        contactoTelefono: String(body.contactoTelefono || "").trim() || null,
        direccion: String(body.direccion || "").trim() || null,
        departamento: String(body.departamento || "").trim() || null,
        ciudad: String(body.ciudad || "").trim() || null,
      },
    })
    .catch(() => null);

  if (!actualizado) return NextResponse.json({ error: "Contratista no encontrado." }, { status: 404 });

  return NextResponse.json(actualizado);
}

/** Elimina un contratista del registro maestro — Administrador o Jefe de Contratación. Solo si no
 * pertenece a ningún expediente: uno con expedientes es parte del expediente contractual y borrarlo
 * dejaría esos expedientes sin contratista. Si tiene una cuenta de acceso vinculada, la cuenta NO se
 * borra (solo se suelta el vínculo con este registro). */
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

  // deleteMany con la condición de "sin expedientes" evita la carrera con un expediente creado entre la
  // verificación y el borrado (la FK lo impediría igual, pero así el error es claro y no un 500).
  const { count } = await db.contratista.deleteMany({ where: { id, expedientes: { none: {} } } });
  if (count === 0) return NextResponse.json({ error: "El contratista acaba de quedar asociado a un expediente; no se eliminó." }, { status: 409 });

  await registrarAuditoria({
    tipo: "CONTRATISTA_ELIMINADO",
    descripcion: `Se eliminó el contratista ${contratista.nombreORazonSocial} (${contratista.identificacion}), que no tenía expedientes.`,
    usuarioId: session.userId,
  });
  return NextResponse.json({ ok: true });
}
