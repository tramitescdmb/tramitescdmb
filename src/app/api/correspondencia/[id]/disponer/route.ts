import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { ejecutarDisposicionFinal } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

/** Ejecuta la disposición final de una comunicación según la TRD de su subserie (Fase 4). */
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

  const form = await req.formData();
  const responsable = String(form.get("responsable") || "");
  const motivacion = String(form.get("motivacion") || "");

  try {
    await ejecutarDisposicionFinal({ comunicacionId: id, responsable, motivacion: motivacion || null, aprobadaPorId: session.userId });
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo ejecutar la disposición final.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "DISPONE",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Ejecutó la disposición final de ${comunicacion.radicado}${responsable ? ` — aprobada por ${responsable}` : ""}`,
  });

  volver.searchParams.set("ok", `Disposición final de ${comunicacion.radicado} registrada.`);
  return NextResponse.redirect(volver, { status: 303 });
}
