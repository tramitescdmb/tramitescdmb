import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { confirmarTransferenciaCentral } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion, registrarErrorEjecucion } from "@/lib/auditoria-doc";

/**
 * Confirma que el archivo central recibió el documento transferido y el proceso
 * concluyó (MoReq 2.17). Hasta este momento la comunicación se conserva y no
 * admite disposición final.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/disposicion`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    volver.searchParams.set("error", "No tiene permiso para administrar el archivo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const comunicacion = await db.comunicacion.findUnique({ where: { id }, select: { radicado: true } });
  if (!comunicacion) {
    volver.searchParams.set("error", "La comunicación no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    await confirmarTransferenciaCentral(id, session.userId);
  } catch (err) {
    await registrarErrorEjecucion("Comunicacion", id, "confirmación de transferencia", session.userId, req.headers, err);
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo confirmar la recepción.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "TRANSFIERE",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Confirmó la recepción de ${comunicacion.radicado} en el archivo central (transferencia concluida)`,
  });

  volver.searchParams.set("ok", `Recepción de ${comunicacion.radicado} confirmada en el archivo central.`);
  return NextResponse.redirect(volver, { status: 303 });
}
