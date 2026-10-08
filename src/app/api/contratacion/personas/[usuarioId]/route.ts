import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";
import { leerDatosPersona, TIPOS_IDENTIFICACION_USUARIO } from "@/lib/datos-persona";
import { dataUsuarioDesdePersona, errorPersonaUsuario } from "@/lib/usuarios-persona";
import { faltantesContratista, puedeEditarDatosDeContratista, SELECT_USUARIO_CONTRATISTA, sincronizarContratistaDeUsuario } from "@/lib/contratacion";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ usuarioId: string }> }) {
  const { usuarioId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarContratistas(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para modificar datos de contratistas." }, { status: 403 });
  }

  const objetivo = await db.usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true, email: true, rol: true, rolesContratacion: true } });
  if (!objetivo) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  if (!permisos.esAdmin && !puedeEditarDatosDeContratista(objetivo)) {
    return NextResponse.json({ error: "Los datos de esta persona solo se modifican desde el administrador de usuarios." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const persona = leerDatosPersona(body?.persona, TIPOS_IDENTIFICACION_USUARIO);
  const error = errorPersonaUsuario(persona);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const actualizado = await db.usuario.update({
    where: { id: usuarioId },
    data: dataUsuarioDesdePersona(persona),
    select: SELECT_USUARIO_CONTRATISTA,
  });
  await sincronizarContratistaDeUsuario(usuarioId);
  await registrarAuditoria({
    tipo: "USUARIO_ACTUALIZADO",
    descripcion: `${session.nombre} actualizó desde GECON los datos personales de "${actualizado.nombre}" (${objetivo.email}).`,
    usuarioId: session.userId,
  });

  return NextResponse.json({ nombre: actualizado.nombre, identificacion: actualizado.cedulaONit ?? "", faltantes: faltantesContratista(actualizado) });
}
