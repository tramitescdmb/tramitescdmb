import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { hashPassword } from "@/lib/password";
import { validarPoliticaPassword } from "@/lib/password-policy";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { registrarAuditoria } from "@/lib/auditoria";
import { esClaveDenominacion, esSexo, admiteEncargo } from "@/lib/denominacion-empleo";
import { leerDatosPersona, TIPOS_IDENTIFICACION_USUARIO } from "@/lib/datos-persona";
import { dataUsuarioDesdePersona, errorPersonaUsuario } from "@/lib/usuarios-persona";

const SIN_CONTRASENA_LOCAL = "directorio-activo:sin-contrasena-local";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede crear usuarios." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const directorioActivo = body.acceso === "DIRECTORIO_ACTIVO";
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const rol = body.rol === "ADMIN" ? "ADMIN" : "FUNCIONARIO";
  const cargoIds = Array.isArray(body.cargoIds) ? body.cargoIds.filter((v: unknown): v is string => typeof v === "string") : [];
  const cargoEncargoIds = new Set<string>(
    Array.isArray(body.cargoEncargoIds) ? body.cargoEncargoIds.filter((v: unknown): v is string => typeof v === "string") : []
  );
  const sexo = esSexo(body.sexo) ? body.sexo : null;
  const denominacionEmpleo = esClaveDenominacion(body.denominacionEmpleo) ? body.denominacionEmpleo : null;
  const denominacionComplemento = typeof body.denominacionComplemento === "string" ? body.denominacionComplemento.trim().slice(0, 120) || null : null;
  const denominacionEncargo = admiteEncargo(denominacionEmpleo) && Boolean(body.denominacionEncargo);
  const accesoFirma = body.accesoFirma !== false;
  const persona = leerDatosPersona(body.persona, TIPOS_IDENTIFICACION_USUARIO);

  if (!email) {
    return NextResponse.json({ error: directorioActivo ? "Indique el usuario de red." : "Indique el correo con el que inicia sesión." }, { status: 400 });
  }
  if (directorioActivo && /[\s@]/.test(email)) {
    return NextResponse.json({ error: "El usuario de red va sin espacios y sin @dominio (ej. jperez01)." }, { status: 400 });
  }
  if (!directorioActivo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "El correo para iniciar sesión no es válido." }, { status: 400 });
  }
  const errorPersona = errorPersonaUsuario(persona);
  if (errorPersona) return NextResponse.json({ error: errorPersona }, { status: 400 });

  if (!directorioActivo) {
    const errorPassword = validarPoliticaPassword(password, await getConfiguracionSitio());
    if (errorPassword) return NextResponse.json({ error: errorPassword }, { status: 400 });
  }

  if (await db.usuario.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.json({ error: directorioActivo ? "Ese usuario de red ya tiene cuenta." : "Ya existe un usuario con ese correo." }, { status: 409 });
  }
  if (cargoIds.length > 0 && (await db.cargo.count({ where: { id: { in: cargoIds } } })) !== cargoIds.length) {
    return NextResponse.json({ error: "Alguno de los cargos seleccionados no existe." }, { status: 400 });
  }

  const nuevo = await db.usuario.create({
    data: {
      email,
      rol,
      directorioActivo,
      passwordHash: directorioActivo ? SIN_CONTRASENA_LOCAL : await hashPassword(password),
      passwordCambiadaEn: directorioActivo ? null : new Date(),
      sexo,
      denominacionEmpleo,
      denominacionComplemento,
      denominacionEncargo,
      accesoFirma,
      ...dataUsuarioDesdePersona(persona),
      cargoAsignaciones: { create: cargoIds.map((id: string) => ({ cargoId: id, encargo: cargoEncargoIds.has(id) })) },
    },
    select: { id: true, nombre: true, email: true },
  });

  await registrarAuditoria({
    tipo: "USUARIO_CREADO",
    descripcion: `${session.nombre} creó el usuario "${nuevo.nombre}" (${nuevo.email}${directorioActivo ? ", directorio activo" : ""}), rol ${rol}.`,
    usuarioId: session.userId,
  });

  return NextResponse.json({ id: nuevo.id }, { status: 201 });
}
