import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeAdministrarArchivo } from "@/lib/permisos";
import {
  iniciarInstancia,
  avanzarInstancia,
  cancelarInstancia,
  reasignarPasoManual,
  puedeOperarFlujos,
  usuarioFlujo,
  type ContextoOperador,
} from "@/lib/flujos";
import { registrarAccesoDenegadoAccion, datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}#flujo`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const form = await req.formData();
  const accion = String(form.get("accion") || "");
  const requiereOperador = accion === "iniciar" || accion === "cancelar";
  const requiereAdmin = accion === "reasignar";
  if (!puedeAccederCorrespondencia(permisos) || (requiereOperador && !puedeOperarFlujos(permisos)) || (requiereAdmin && !puedeAdministrarArchivo(permisos))) {
    await registrarAccesoDenegadoAccion("Operar flujo de trabajo", id, session, await headers());
    volver.searchParams.set("error", "No tiene permiso para esta acción del flujo de trabajo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip } = datosPeticion(await headers());
  const usuario = await usuarioFlujo(session.userId, permisos);
  const ctx: ContextoOperador = { esAdminArchivo: usuario.esAdminArchivo, dependenciaId: usuario.dependenciaId };
  try {
    if (accion === "iniciar") {
      await iniciarInstancia(id, String(form.get("flujoId") || ""), session.userId, ip, ctx);
      volver.searchParams.set("ok", "Flujo iniciado.");
    } else if (accion === "avanzar") {
      await avanzarInstancia(
        String(form.get("instanciaId") || ""),
        String(form.get("transicionId") || ""),
        usuario,
        String(form.get("comentario") || "") || null,
        ip,
        usuario.esAdminArchivo ? ctx : undefined,
        String(form.get("asignarAId") || "") || null,
      );
      volver.searchParams.set("ok", "Paso completado.");
    } else if (accion === "cancelar") {
      await cancelarInstancia(String(form.get("instanciaId") || ""), session.userId, String(form.get("motivo") || ""), ip, ctx);
      volver.searchParams.set("ok", "Flujo cancelado.");
    } else if (accion === "reasignar") {
      await reasignarPasoManual(String(form.get("instanciaId") || ""), String(form.get("asignarAId") || ""), session.userId, ip);
      volver.searchParams.set("ok", "Paso reasignado.");
    } else {
      volver.searchParams.set("error", "Acción no reconocida.");
    }
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo completar la acción.");
  }
  return NextResponse.redirect(volver, { status: 303 });
}
