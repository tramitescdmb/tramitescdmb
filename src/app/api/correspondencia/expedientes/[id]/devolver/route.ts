import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarExpedienteDeDependencia } from "@/lib/permisos";
import { devolverExpediente } from "@/lib/expedientes-documentales";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

/** Registra la devolución de un expediente prestado. */
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
    volver.searchParams.set("error", "No tiene permiso para registrar esta devolución.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const prestamoId = String(form.get("prestamoId") || "");
  if (!prestamoId) {
    volver.searchParams.set("error", "Falta indicar cuál préstamo se devuelve.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    await devolverExpediente(prestamoId);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo registrar la devolución.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumental",
    entidadId: id,
    accion: "DEVUELVE",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Registró la devolución de ${expediente.numero}`,
  });

  volver.searchParams.set("ok", `Devolución de ${expediente.numero} registrada.`);
  return NextResponse.redirect(volver, { status: 303 });
}
