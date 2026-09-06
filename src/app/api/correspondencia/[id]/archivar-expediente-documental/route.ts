import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { archivarComunicacionEnExpedienteDocumental } from "@/lib/expedientes-documentales";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

/** Archiva una comunicación ya radicada dentro de un expediente documental (archivo general, no un trámite). */
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
  const numeroExpediente = String(form.get("numeroExpedienteDocumental") || "").trim();
  if (!numeroExpediente) {
    volver.searchParams.set("error", "Indique el número del expediente (ej. CDMB-X-2026-000001).");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const expediente = await db.expedienteDocumental.findUnique({ where: { numero: numeroExpediente }, select: { id: true, numero: true } });
  if (!expediente) {
    volver.searchParams.set("error", `No existe ningún expediente documental con el número ${numeroExpediente}.`);
    return NextResponse.redirect(volver, { status: 303 });
  }

  const comunicacion = await db.comunicacion.findUnique({ where: { id }, select: { radicado: true } });
  if (!comunicacion) {
    volver.searchParams.set("error", "La comunicación no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    await archivarComunicacionEnExpedienteDocumental(id, expediente.id);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo archivar.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "ARCHIVA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Archivó ${comunicacion.radicado} en el expediente documental ${expediente.numero}`,
  });

  volver.searchParams.set("ok", `Archivada en el expediente ${expediente.numero}.`);
  return NextResponse.redirect(volver, { status: 303 });
}
