import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAsignarFirmantesDocumentoTramite } from "@/lib/permisos";
import { asignarFirmantes } from "@/lib/solicitudes-firma";
import type { RolFirmante } from "@prisma/client";

const ROLES_VALIDOS: RolFirmante[] = ["FIRMA", "VISTO_BUENO", "LECTURA"];

/** Asigna quién debe firmar, dar visto bueno o tener solo lectura sobre un documento de un
 * expediente de trámites. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAsignarFirmantesDocumentoTramite(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para asignar firmantes." }, { status: 403 });
  }

  const doc = await db.expedienteDocumento.findUnique({ where: { id }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "El documento no existe." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const firmantesBody = Array.isArray(body?.firmantes) ? body.firmantes : null;
  if (!firmantesBody || firmantesBody.length === 0) {
    return NextResponse.json({ error: "Debe indicar al menos una persona." }, { status: 400 });
  }
  const firmantes: { usuarioId: string; rol: RolFirmante; orden: number }[] = [];
  for (const f of firmantesBody) {
    if (typeof f?.usuarioId !== "string" || !ROLES_VALIDOS.includes(f?.rol)) {
      return NextResponse.json({ error: "Datos de firmante inválidos." }, { status: 400 });
    }
    firmantes.push({ usuarioId: f.usuarioId, rol: f.rol, orden: Number.isFinite(f?.orden) ? Number(f.orden) : 1 });
  }

  try {
    await asignarFirmantes({ tipo: "documentoExpediente", id }, session.userId, firmantes);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo asignar." }, { status: 400 });
  }
}
