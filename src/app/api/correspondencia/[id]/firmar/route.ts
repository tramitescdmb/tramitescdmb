import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";
import { agregarCofirma } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

/** Firma adicional (co-firma) de un oficio o memorando ya radicado (MoReq 1.37). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeRadicar(permisos)) {
    await registrarAccesoDenegadoAccion("firmar la comunicación", id, session, req.headers);
    volver.searchParams.set("error", "No tiene permiso para firmar comunicaciones.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  const comunicacion = await db.comunicacion.findUnique({ where: { id }, select: { radicado: true } });
  if (!comunicacion) {
    volver.searchParams.set("error", "La comunicación no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    await agregarCofirma(id, session.userId, ip);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo registrar la firma.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "FIRMA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Firmó ${comunicacion.radicado} (firma adicional)`,
  }).catch((err) => console.error("registrarAuditoriaDoc (firmar) falló:", err));

  volver.searchParams.set("ok", "Su firma quedó registrada.");
  return NextResponse.redirect(volver, { status: 303 });
}
