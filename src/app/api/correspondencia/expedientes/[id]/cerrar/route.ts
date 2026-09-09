import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeCerrarExpediente } from "@/lib/permisos";
import { cerrarExpedienteDocumental } from "@/lib/expedientes-documentales";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

/** Cierra el expediente y firma su índice electrónico (Art. 4.3.2.4 Acuerdo 001/2024 AGN). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/expedientes/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeCerrarExpediente(permisos)) {
    await registrarAccesoDenegadoAccion("cerrar el expediente", id, session, req.headers);
    volver.searchParams.set("error", "No tiene permiso para cerrar expedientes.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const expediente = await db.expedienteDocumental.findUnique({ where: { id }, select: { numero: true } });
  if (!expediente) {
    volver.searchParams.set("error", "El expediente no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  let cerrado;
  try {
    cerrado = await cerrarExpedienteDocumental(id, session.userId);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo cerrar el expediente.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumental",
    entidadId: id,
    accion: "FIRMA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Cerró ${expediente.numero} y firmó el índice electrónico — SHA-256 ${cerrado.indiceHash?.slice(0, 16)}…`,
  });

  volver.searchParams.set("ok", `${expediente.numero} cerrado. Índice electrónico firmado.`);
  return NextResponse.redirect(volver, { status: 303 });
}
