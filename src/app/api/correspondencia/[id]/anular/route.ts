import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { anularComunicacion } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

/** Anula un radicado erróneo con motivo (Ley 594/2000). No se borra: queda marcado y trazado. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    volver.searchParams.set("error", "No tiene permiso para anular una comunicación.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const comunicacion = await db.comunicacion.findUnique({ where: { id }, select: { radicado: true } });
  if (!comunicacion) {
    volver.searchParams.set("error", "La comunicación no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const motivo = String(form.get("motivo") || "");

  try {
    await anularComunicacion(id, motivo);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo anular la comunicación.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "ANULA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Anuló ${comunicacion.radicado} — motivo: ${motivo.trim().slice(0, 300)}`,
  });

  volver.searchParams.set("ok", `${comunicacion.radicado} anulada.`);
  return NextResponse.redirect(volver, { status: 303 });
}
