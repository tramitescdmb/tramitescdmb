import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeDistribuir } from "@/lib/permisos";
import { suspenderTermino } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

/** Suspende el término de ley (Art. 17 CPACA) mientras se espera información adicional del peticionario. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeDistribuir(permisos)) {
    volver.searchParams.set("error", "No tiene permiso para suspender términos.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const comunicacion = await db.comunicacion.findUnique({ where: { id }, select: { radicado: true } });
  if (!comunicacion) {
    volver.searchParams.set("error", "La comunicación no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    await suspenderTermino(id);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo suspender el término.");
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
    detalle: `Suspendió el término de ${comunicacion.radicado} (información adicional requerida)`,
  });

  volver.searchParams.set("ok", "Término suspendido: se solicitó información adicional al peticionario.");
  return NextResponse.redirect(volver, { status: 303 });
}
