import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarExpedienteDeDependencia } from "@/lib/permisos";
import { prestarExpediente } from "@/lib/expedientes-documentales";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { parsearFechaLocal } from "@/lib/periodo-dashboard";

/** Presta un expediente documental a un funcionario — solo deja rastro de quién lo tiene, no bloquea nada. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/expedientes/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const expediente = await db.expedienteDocumental.findUnique({ where: { id }, select: { numero: true, dependenciaId: true } });
  if (!expediente) {
    volver.searchParams.set("error", "El expediente no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (!puedeGestionarExpedienteDeDependencia(permisos, expediente.dependenciaId)) {
    volver.searchParams.set("error", "No tiene permiso para prestar este expediente.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const prestadoAId = String(form.get("prestadoAId") || "");
  const motivo = String(form.get("motivo") || "");
  const fechaDevolucionEsperadaRaw = String(form.get("fechaDevolucionEsperada") || "");
  if (!prestadoAId) {
    volver.searchParams.set("error", "Elija a quién se le presta el expediente.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  const prestadoA = await db.usuario.findUnique({ where: { id: prestadoAId }, select: { nombre: true, activo: true } });
  if (!prestadoA || !prestadoA.activo) {
    volver.searchParams.set("error", "Ese usuario no existe o está inactivo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    await prestarExpediente({
      expedienteId: id,
      prestadoAId,
      prestadoPorId: session.userId,
      motivo,
      fechaDevolucionEsperada: fechaDevolucionEsperadaRaw ? parsearFechaLocal(fechaDevolucionEsperadaRaw) : null,
    });
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo registrar el préstamo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumental",
    entidadId: id,
    accion: "PRESTA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Prestó ${expediente.numero} a ${prestadoA.nombre}${motivo.trim() ? ` — motivo: ${motivo.trim().slice(0, 300)}` : ""}`,
  });

  volver.searchParams.set("ok", `${expediente.numero} prestado a ${prestadoA.nombre}.`);
  return NextResponse.redirect(volver, { status: 303 });
}
