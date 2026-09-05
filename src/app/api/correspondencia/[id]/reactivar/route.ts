import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeDistribuir } from "@/lib/permisos";
import { reactivarTermino } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

/** Reactiva un término suspendido: se reanuda por los días hábiles que faltaban (Art. 17 CPACA). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeDistribuir(permisos)) {
    volver.searchParams.set("error", "No tiene permiso para reactivar términos.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const comunicacion = await db.comunicacion.findUnique({ where: { id }, select: { radicado: true } });
  if (!comunicacion) {
    volver.searchParams.set("error", "La comunicación no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    await reactivarTermino(id);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo reactivar el término.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "REACTIVA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Reactivó el término de ${comunicacion.radicado}`,
  });

  volver.searchParams.set("ok", "Término reactivado.");
  return NextResponse.redirect(volver, { status: 303 });
}
