import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarExpedienteDeDependencia } from "@/lib/permisos";
import { editarExpedienteDocumental } from "@/lib/expedientes-documentales";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

/** Renombra (asunto/descripción) un expediente documental ya existente. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/expedientes/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const expediente = await db.expedienteDocumental.findUnique({ where: { id }, select: { numero: true, asunto: true, dependenciaId: true } });
  if (!expediente) {
    volver.searchParams.set("error", "El expediente no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (!puedeGestionarExpedienteDeDependencia(permisos, expediente.dependenciaId)) {
    await registrarAccesoDenegadoAccion("editar el expediente", id, session, req.headers);
    volver.searchParams.set("error", "No tiene permiso para editar este expediente.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const asunto = String(form.get("asunto") || "");
  const descripcion = String(form.get("descripcion") || "");
  const asuntoAnterior = expediente.asunto;

  try {
    await editarExpedienteDocumental(id, { asunto, descripcion: descripcion || null });
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo editar el expediente.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumental",
    entidadId: id,
    accion: "MODIFICA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Editó ${expediente.numero}: asunto "${asuntoAnterior}" → "${asunto.trim()}"`,
  });

  volver.searchParams.set("ok", `${expediente.numero} actualizado.`);
  return NextResponse.redirect(volver, { status: 303 });
}
