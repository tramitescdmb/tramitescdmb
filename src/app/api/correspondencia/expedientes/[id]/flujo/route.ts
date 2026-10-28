import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeAdministrarArchivo, puedeGestionarExpedienteDeDependencia } from "@/lib/permisos";
import {
  iniciarInstanciaExpediente,
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
  const volver = new URL(`/correspondencia/expedientes/${id}#flujo`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  const expediente = await db.expedienteDocumental.findUnique({ where: { id }, select: { dependenciaId: true } });

  const form = await req.formData();
  const accion = String(form.get("accion") || "");
  const operador = puedeOperarFlujos(permisos) || Boolean(expediente && puedeGestionarExpedienteDeDependencia(permisos, expediente.dependenciaId));
  const requiereOperador = accion === "iniciar" || accion === "cancelar";
  const requiereAdmin = accion === "reasignar";
  if (!expediente || !puedeAccederCorrespondencia(permisos) || (requiereOperador && !operador) || (requiereAdmin && !puedeAdministrarArchivo(permisos))) {
    await registrarAccesoDenegadoAccion("Operar flujo de trabajo de expediente", id, session, await headers());
    volver.searchParams.set("error", "No tiene permiso para esta acción del flujo de trabajo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip } = datosPeticion(await headers());
  const usuario = await usuarioFlujo(session.userId, permisos);
  const ctx: ContextoOperador = { esAdminArchivo: usuario.esAdminArchivo, dependenciaId: usuario.dependenciaId };
  const instanciaId = String(form.get("instanciaId") || "");
  if (instanciaId && !(await db.instanciaFlujo.findFirst({ where: { id: instanciaId, expedienteDocumentalId: id }, select: { id: true } }))) {
    volver.searchParams.set("error", "El flujo no corresponde a este expediente.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  try {
    if (accion === "iniciar") {
      await iniciarInstanciaExpediente(id, String(form.get("flujoId") || ""), session.userId, ip, ctx);
      volver.searchParams.set("ok", "Flujo iniciado.");
    } else if (accion === "avanzar") {
      await avanzarInstancia(
        instanciaId,
        String(form.get("transicionId") || ""),
        usuario,
        String(form.get("comentario") || "") || null,
        ip,
        usuario.esAdminArchivo ? ctx : undefined,
        String(form.get("asignarAId") || "") || null,
      );
      volver.searchParams.set("ok", "Paso completado.");
    } else if (accion === "cancelar") {
      await cancelarInstancia(instanciaId, session.userId, String(form.get("motivo") || ""), ip, ctx);
      volver.searchParams.set("ok", "Flujo cancelado.");
    } else if (accion === "reasignar") {
      await reasignarPasoManual(instanciaId, String(form.get("asignarAId") || ""), session.userId, ip);
      volver.searchParams.set("ok", "Paso reasignado.");
    } else {
      volver.searchParams.set("error", "Acción no reconocida.");
    }
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo completar la acción.");
  }
  return NextResponse.redirect(volver, { status: 303 });
}
