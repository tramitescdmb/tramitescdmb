import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { iniciarInstancia, avanzarInstancia, cancelarInstancia, puedeOperarFlujos, type ContextoOperador } from "@/lib/flujos";
import { registrarAccesoDenegadoAccion, datosPeticion } from "@/lib/auditoria-doc";
import { db } from "@/lib/db";

/** Inicia, avanza o cancela un flujo sobre una comunicación. `accion` = "iniciar" | "avanzar" | "cancelar". */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}#flujo`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeOperarFlujos(permisos)) {
    await registrarAccesoDenegadoAccion("Operar flujo de trabajo", id, session, await headers());
    volver.searchParams.set("error", "No tiene permiso para operar flujos de trabajo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const accion = String(form.get("accion") || "");
  const { ip } = datosPeticion(await headers());
  const usuario = await db.usuario.findUnique({ where: { id: session.userId }, select: { dependenciaId: true } });
  const ctx: ContextoOperador = { esAdminArchivo: puedeAdministrarArchivo(permisos), dependenciaId: usuario?.dependenciaId ?? null };
  try {
    if (accion === "iniciar") {
      await iniciarInstancia(id, String(form.get("flujoId") || ""), session.userId, ip, ctx);
      volver.searchParams.set("ok", "Flujo iniciado.");
    } else if (accion === "avanzar") {
      await avanzarInstancia(
        String(form.get("instanciaId") || ""),
        String(form.get("transicionId") || ""),
        session.userId,
        String(form.get("comentario") || "") || null,
        ip,
        ctx,
      );
      volver.searchParams.set("ok", "Paso completado.");
    } else if (accion === "cancelar") {
      await cancelarInstancia(String(form.get("instanciaId") || ""), session.userId, String(form.get("motivo") || ""), ip);
      volver.searchParams.set("ok", "Flujo cancelado.");
    } else {
      volver.searchParams.set("error", "Acción no reconocida.");
    }
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo completar la acción.");
  }
  return NextResponse.redirect(volver, { status: 303 });
}
