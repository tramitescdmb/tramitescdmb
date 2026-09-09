import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeDistribuir } from "@/lib/permisos";
import { camposMetadatoPara, guardarMetadatosComunicacion } from "@/lib/metadatos";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";
import { db } from "@/lib/db";

/** Guarda los metadatos adicionales de una comunicación. Gateado por puedeDistribuir. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}#metadatos`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeDistribuir(permisos)) {
    await registrarAccesoDenegadoAccion("Editar metadatos de una comunicación", id, session, await headers());
    volver.searchParams.set("error", "No tiene permiso para editar los metadatos.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const c = await db.comunicacion.findUnique({ where: { id }, select: { serieId: true, radicado: true } });
  if (!c) {
    volver.searchParams.set("error", "La comunicación no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  const campos = await camposMetadatoPara("COMUNICACION", c.serieId);
  const form = await req.formData();
  const entrada: Record<string, string> = {};
  for (const campo of campos) entrada[campo.clave] = String(form.get(`m_${campo.clave}`) ?? "");

  try {
    await guardarMetadatosComunicacion(id, entrada);
    const { ip, userAgent } = datosPeticion(await headers());
    await registrarAuditoriaDoc({
      entidad: "Comunicacion",
      entidadId: id,
      accion: "MODIFICA",
      usuarioId: session.userId,
      ip,
      userAgent,
      detalle: `Actualizó los metadatos adicionales de ${c.radicado}`,
    });
    volver.searchParams.set("ok", "Metadatos guardados.");
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudieron guardar los metadatos.");
  }
  return NextResponse.redirect(volver, { status: 303 });
}
