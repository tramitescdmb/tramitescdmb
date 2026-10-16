import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeSubirDocumentoContrato } from "@/lib/permisos";
import { registrarEventoContratacion } from "@/lib/contratacion";
import { MENSAJE_EXPEDIENTE_CERRADO } from "@/lib/archivo-central";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.requiereFirma !== "boolean") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const doc = await db.documentoContrato.findUnique({
    where: { id },
    select: {
      nombre: true,
      etapa: true,
      requiereFirma: true,
      cargadoEnSecop: true,
      expediente: { select: { id: true, contratistaId: true, cerrado: true } },
      _count: { select: { firmas: true, solicitudesFirma: { where: { rol: "FIRMA", estado: { not: "RECHAZADA" } } } } },
    },
  });
  if (!doc) return NextResponse.json({ error: "El documento no existe." }, { status: 404 });
  if (doc.expediente.cerrado) return NextResponse.json({ error: MENSAJE_EXPEDIENTE_CERRADO }, { status: 409 });
  if (!puedeSubirDocumentoContrato(permisos, doc.expediente, doc.etapa)) {
    return NextResponse.json({ error: "No tiene permiso sobre los documentos de esta etapa." }, { status: 403 });
  }
  if (doc.cargadoEnSecop) return NextResponse.json({ error: "Este documento ya fue cargado en SECOP II — no requiere firma interna." }, { status: 400 });
  if (!body.requiereFirma && (doc._count.firmas > 0 || doc._count.solicitudesFirma > 0)) {
    return NextResponse.json({ error: "El documento ya tiene firmantes: no se puede quitar la marca." }, { status: 400 });
  }
  if (doc.requiereFirma === body.requiereFirma) return NextResponse.json({ ok: true });

  await db.documentoContrato.update({ where: { id }, data: { requiereFirma: body.requiereFirma } });
  await registrarEventoContratacion(
    doc.expediente.id,
    "DOCUMENTO_EDITADO",
    body.requiereFirma ? `Marcó «Requiere firma» en "${doc.nombre}"` : `Quitó la marca «Requiere firma» de "${doc.nombre}"`,
    session.userId
  );
  return NextResponse.json({ ok: true });
}
