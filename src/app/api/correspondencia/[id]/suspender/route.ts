import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeDistribuir } from "@/lib/permisos";
import { suspenderTermino } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

/** Detiene el trámite de una recibida en curso, con motivo (MoReq 7.18). Si es PQRSD, suspende el término (Art. 17 CPACA). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeDistribuir(permisos)) {
    await registrarAccesoDenegadoAccion("detener el trámite", id, session, req.headers);
    volver.searchParams.set("error", "No tiene permiso para detener trámites.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const comunicacion = await db.comunicacion.findUnique({ where: { id }, select: { radicado: true, fechaVencimiento: true } });
  if (!comunicacion) {
    volver.searchParams.set("error", "La comunicación no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const motivo = String(form.get("motivo") || "");
  try {
    await suspenderTermino(id, motivo);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo detener el trámite.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "SUSPENDE",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Detuvo el trámite de ${comunicacion.radicado}${comunicacion.fechaVencimiento ? " (suspende el término de ley)" : ""} — motivo: ${motivo.trim()}`,
  });

  volver.searchParams.set("ok", comunicacion.fechaVencimiento ? "Trámite detenido y término suspendido." : "Trámite detenido.");
  return NextResponse.redirect(volver, { status: 303 });
}
