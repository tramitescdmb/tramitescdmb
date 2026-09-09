import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { esCriterioOrdenValido } from "@/lib/expedientes-documentales";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

/**
 * Cambia el criterio de ordenación de los documentos de los expedientes de una
 * serie (MoReq 1.46). No toca el índice firmado — solo el orden visual.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(req.headers.get("referer") || "/correspondencia/expedientes", req.url);
  volver.search = "";
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoAccion("cambiar el criterio de orden", id, session, req.headers);
    volver.searchParams.set("error", "No tiene permiso para administrar el archivo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const criterio = String(form.get("criterio") || "");
  if (!esCriterioOrdenValido(criterio)) {
    volver.searchParams.set("error", "Criterio de orden no válido.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const serie = await db.serieDocumental.findUnique({ where: { id }, select: { codigo: true } });
  if (!serie) {
    volver.searchParams.set("error", "La serie no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  await db.serieDocumental.update({ where: { id }, data: { criterioOrdenExpediente: criterio } });

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "SerieDocumental",
    entidadId: id,
    accion: "MODIFICA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Cambió el criterio de orden de los expedientes de la serie ${serie.codigo} a ${criterio}`,
  }).catch((err) => console.error("registrarAuditoriaDoc (criterio-orden) falló:", err));

  volver.searchParams.set("ok", "Criterio de orden actualizado.");
  return NextResponse.redirect(volver, { status: 303 });
}
