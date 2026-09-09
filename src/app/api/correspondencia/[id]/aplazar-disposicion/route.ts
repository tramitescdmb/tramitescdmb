import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { aplazarDisposicion } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion, registrarErrorEjecucion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

/** Aplaza la disposición final ya vencida de una comunicación, con motivo (MoReq 2.11). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL("/correspondencia/disposicion", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoAccion("aplazar la disposición final", id, session, req.headers);
    volver.searchParams.set("error", "No tiene permiso para administrar el archivo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const comunicacion = await db.comunicacion.findUnique({ where: { id }, select: { radicado: true } });
  if (!comunicacion) {
    volver.searchParams.set("error", "La comunicación no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const hastaTexto = String(form.get("hasta") || "");
  const motivo = String(form.get("motivo") || "");
  const hasta = hastaTexto ? new Date(`${hastaTexto}T00:00:00`) : null;

  if (!hasta || Number.isNaN(hasta.getTime())) {
    volver.searchParams.set("error", "Indique una fecha válida.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    await aplazarDisposicion(id, hasta, motivo);
  } catch (err) {
    await registrarErrorEjecucion("Comunicacion", id, "aplazamiento de disposición", session.userId, req.headers, err);
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo aplazar la disposición.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "APLAZA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Aplazó la disposición final de ${comunicacion.radicado} hasta ${hastaTexto} — ${motivo.trim().slice(0, 300)}`,
  });

  volver.searchParams.set("ok", `Disposición final de ${comunicacion.radicado} aplazada hasta ${hastaTexto}.`);
  return NextResponse.redirect(volver, { status: 303 });
}
