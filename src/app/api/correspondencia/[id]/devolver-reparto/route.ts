import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeDevolverReparto } from "@/lib/permisos";
import { devolverReparto } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion, registrarErrorEjecucion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

/**
 * El funcionario al que se le repartió una recibida la devuelve a la ventanilla,
 * indicando por qué no le corresponde. La ventanilla la reparte de nuevo.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const comunicacion = await db.comunicacion.findUnique({
    where: { id },
    select: { radicado: true, distribuciones: { where: { activa: true }, select: { usuarioId: true, dependenciaId: true } } },
  });
  if (!comunicacion) {
    volver.searchParams.set("error", "La comunicación no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (!puedeDevolverReparto(permisos, session.userId, comunicacion.distribuciones)) {
    await registrarAccesoDenegadoAccion("devolver el reparto", id, session, req.headers);
    volver.searchParams.set("error", "Solo el funcionario al que se le repartió puede devolverla a la ventanilla.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const motivo = String(form.get("motivo") || "");

  let resultado: { radicado: string };
  try {
    resultado = await devolverReparto(id, session.userId, motivo);
  } catch (err) {
    await registrarErrorEjecucion("Comunicacion", id, "devolución de reparto", session.userId, req.headers, err);
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo devolver el reparto.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "DEVUELVE_REPARTO",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `${session.nombre} devolvió ${resultado.radicado} a la ventanilla — motivo: ${motivo.trim().slice(0, 300)}`,
  });

  volver.searchParams.set("ok", `${resultado.radicado} devuelta a la ventanilla. La ventanilla la repartirá de nuevo.`);
  return NextResponse.redirect(volver, { status: 303 });
}
