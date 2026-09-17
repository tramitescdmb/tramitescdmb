import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas } from "@/lib/permisos";

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

  const actualizado = await db.contratista
    .update({
      where: { id },
      data: {
        nombreORazonSocial,
        contactoEmail: String(body.contactoEmail || "").trim() || null,
        contactoTelefono: String(body.contactoTelefono || "").trim() || null,
        direccion: String(body.direccion || "").trim() || null,
        ciudad: String(body.ciudad || "").trim() || null,
      },
    })
    .catch(() => null);

  if (!actualizado) return NextResponse.json({ error: "Contratista no encontrado." }, { status: 404 });

  return NextResponse.json(actualizado);
}
