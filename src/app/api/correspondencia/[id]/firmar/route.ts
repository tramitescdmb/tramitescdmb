import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeFirmar, puedeFirmarComunicacionDirecto } from "@/lib/permisos";
import type { CalidadFirma } from "@prisma/client";

function leerCalidad(valor: unknown): CalidadFirma | null {
  return valor === "PRINCIPAL" || valor === "PROYECTO" || valor === "REVISO" ? valor : null;
}
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
  const comunicacion = await db.comunicacion.findUnique({
    where: { id },
    select: {
      radicado: true,
      radicadoPorId: true,
      solicitudesFirma: { where: { usuarioAsignadoId: session.userId, estado: "PENDIENTE", rol: "FIRMA" }, select: { id: true } },
    },
  });
  if (!comunicacion) return responder(false, "La comunicación no existe.", 404);
  const tieneSolicitud = comunicacion.solicitudesFirma.length > 0;
  if (!puedeFirmar(permisos) || (!tieneSolicitud && !puedeFirmarComunicacionDirecto(permisos, comunicacion, session.userId))) {
    await registrarAccesoDenegadoAccion("firmar la comunicación", id, session, req.headers);
    return responder(false, "La ventanilla de radicación no firma comunicaciones: firman los funcionarios que proyectan, revisan o aprueban el documento.", 403);
  }

  let calidad: CalidadFirma | null = null;
  const tipoContenido = req.headers.get("content-type") ?? "";
  if (tipoContenido.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    calidad = leerCalidad(body?.calidad);
  } else if (tipoContenido.includes("form")) {
    calidad = leerCalidad((await req.formData()).get("calidad"));
  }

  const { ip, userAgent } = datosPeticion(req.headers);

  try {
    await agregarCofirma(id, session.userId, ip, userAgent, calidad);
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
