import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { archivarEnExpediente } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

/** Archiva una comunicación ya radicada dentro de un expediente de Trámites 2.0 (unificación). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) {
    volver.searchParams.set("error", "No tiene acceso a correspondencia.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const numeroExpediente = String(form.get("numeroExpediente") || "").trim();
  if (!numeroExpediente) {
    volver.searchParams.set("error", "Indique el número de expediente (ej. M-DA-PR05-2026-0001).");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const expediente = await db.expediente.findUnique({ where: { numero: numeroExpediente }, select: { id: true, numero: true } });
  if (!expediente) {
    volver.searchParams.set("error", `No existe ningún expediente con el número ${numeroExpediente}.`);
    return NextResponse.redirect(volver, { status: 303 });
  }

  const comunicacion = await db.comunicacion.findUnique({ where: { id }, select: { radicado: true } });
  if (!comunicacion) {
    volver.searchParams.set("error", "La comunicación no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  await archivarEnExpediente(id, expediente.id);

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "ARCHIVA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Archivó ${comunicacion.radicado} en el expediente ${expediente.numero}`,
  });

  volver.searchParams.set("ok", `Archivada en el expediente ${expediente.numero}.`);
  return NextResponse.redirect(volver, { status: 303 });
}
