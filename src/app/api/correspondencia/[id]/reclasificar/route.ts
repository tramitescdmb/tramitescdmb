import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { reclasificarComunicacion } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

/** Reclasifica un radicado a otra serie/subserie de la TRD con motivo (MoReq req. 1.30-1.32). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    volver.searchParams.set("error", "No tiene permiso para reclasificar una comunicación.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const comunicacion = await db.comunicacion.findUnique({ where: { id }, select: { radicado: true } });
  if (!comunicacion) {
    volver.searchParams.set("error", "La comunicación no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const subserieId = String(form.get("subserieId") || "");
  const motivo = String(form.get("motivo") || "");

  let resultado: { anterior: string; nueva: string };
  try {
    resultado = await reclasificarComunicacion(id, subserieId, motivo);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo reclasificar la comunicación.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "CLASIFICA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Reclasificó ${comunicacion.radicado}: "${resultado.anterior}" → "${resultado.nueva}" — motivo: ${motivo.trim().slice(0, 300)}`,
  });

  volver.searchParams.set("ok", `${comunicacion.radicado} reclasificada.`);
  return NextResponse.redirect(volver, { status: 303 });
}
