import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeCerrarExpediente } from "@/lib/permisos";
import { reabrirExpedienteDocumental } from "@/lib/expedientes-documentales";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

/** Reabre un expediente cerrado (MoReq 1.14) — mismo permiso que lo cierra, motivo obligatorio y auditado. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/expedientes/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeCerrarExpediente(permisos)) {
    await registrarAccesoDenegadoAccion("reabrir el expediente", id, session, req.headers);
    volver.searchParams.set("error", "No tiene permiso para reabrir expedientes.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const expediente = await db.expedienteDocumental.findUnique({ where: { id }, select: { numero: true } });
  if (!expediente) {
    volver.searchParams.set("error", "El expediente no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const motivo = String(form.get("motivo") || "");

  try {
    await reabrirExpedienteDocumental(id, motivo);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo reabrir el expediente.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumental",
    entidadId: id,
    accion: "REABRE",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Reabrió ${expediente.numero} — motivo: ${motivo.trim().slice(0, 300)}`,
  });

  volver.searchParams.set("ok", `${expediente.numero} reabierto.`);
  return NextResponse.redirect(volver, { status: 303 });
}
