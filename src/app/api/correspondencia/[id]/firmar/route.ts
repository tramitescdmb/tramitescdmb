import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeFirmar } from "@/lib/permisos";
import { agregarCofirma } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}`, req.url);
  const json = req.headers.get("accept")?.includes("application/json") ?? false;
  const responder = (ok: boolean, mensaje: string, status = 400) => {
    if (json) return NextResponse.json(ok ? { ok: true } : { error: mensaje }, { status: ok ? 200 : status });
    volver.searchParams.set(ok ? "ok" : "error", mensaje);
    return NextResponse.redirect(volver, { status: 303 });
  };
  if (!session) return json ? NextResponse.json({ error: "No autenticado" }, { status: 401 }) : NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeFirmar(permisos)) {
    await registrarAccesoDenegadoAccion("firmar la comunicación", id, session, req.headers);
    return responder(false, "No tiene permiso para firmar comunicaciones.", 403);
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  const comunicacion = await db.comunicacion.findUnique({ where: { id }, select: { radicado: true } });
  if (!comunicacion) return responder(false, "La comunicación no existe.", 404);

  try {
    await agregarCofirma(id, session.userId, ip, userAgent);
  } catch (err) {
    return responder(false, err instanceof Error ? err.message : "No se pudo registrar la firma.");
  }

  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "FIRMA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Firmó ${comunicacion.radicado}`,
  }).catch((err) => console.error("registrarAuditoriaDoc (firmar) falló:", err));

  return responder(true, "Su firma quedó registrada.");
}
