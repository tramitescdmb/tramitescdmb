import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas } from "@/lib/permisos";
import { hashPassword } from "@/lib/password";
import { registrarAuditoria } from "@/lib/auditoria";
import { camposFaltantes, leerDatosPersona, REQUERIDOS_CONTRATISTA, TIPOS_IDENTIFICACION_USUARIO } from "@/lib/datos-persona";
import { dataUsuarioDesdePersona, errorPersonaUsuario } from "@/lib/usuarios-persona";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarContratistas(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para registrar contratistas." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const persona = leerDatosPersona(body?.persona, TIPOS_IDENTIFICACION_USUARIO);
  const usuarioRed = typeof body?.usuarioRed === "string" ? body.usuarioRed.trim().toLowerCase() : "";

  const error = errorPersonaUsuario(persona);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const faltan = camposFaltantes(persona, REQUERIDOS_CONTRATISTA);
  if (faltan.length > 0) return NextResponse.json({ error: `Faltan datos: ${faltan.join(", ")}.` }, { status: 400 });
  if (usuarioRed && /[\s@]/.test(usuarioRed)) {
    return NextResponse.json({ error: "El usuario de red va sin espacios y sin @dominio (ej. jperez01)." }, { status: 400 });
  }

  const email = usuarioRed || persona.email;
  const [porLogin, porDocumento] = await Promise.all([
    db.usuario.findUnique({ where: { email }, select: { id: true, nombre: true } }),
    db.usuario.findFirst({ where: { cedulaONit: persona.identificacion }, select: { id: true, nombre: true } }),
  ]);
  if (porDocumento) {
    return NextResponse.json({ error: `El documento ${persona.identificacion} ya está registrado a nombre de ${porDocumento.nombre}; búsquelo en la lista.` }, { status: 409 });
  }
  if (porLogin) {
    return NextResponse.json({ error: `${usuarioRed ? "El usuario de red" : "El correo"} ${email} ya pertenece a ${porLogin.nombre}.` }, { status: 409 });
  }

  const creado = await db.usuario.create({
    data: {
      email,
      rol: "FUNCIONARIO",
      directorioActivo: Boolean(usuarioRed),
      passwordHash: usuarioRed ? "directorio-activo:sin-contrasena-local" : await hashPassword(randomUUID()),
      passwordCambiadaEn: usuarioRed ? null : new Date(),
      ...dataUsuarioDesdePersona(persona),
    },
    select: { id: true, nombre: true, cedulaONit: true },
  });
  await registrarAuditoria({
    tipo: "USUARIO_CREADO",
    descripcion: `${session.nombre} registró desde GECON a "${creado.nombre}" (${email}${usuarioRed ? ", directorio activo" : ", cuenta local sin contraseña asignada"}).`,
    usuarioId: session.userId,
  });

  return NextResponse.json({ usuarioId: creado.id, nombre: creado.nombre, identificacion: creado.cedulaONit ?? "" }, { status: 201 });
}
