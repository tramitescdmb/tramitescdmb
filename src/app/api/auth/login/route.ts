import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { registrarAuditoria } from "@/lib/auditoria";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import {
  autenticarDirectorioActivo,
  directorioActivoConfigurado,
  guardarTokenDirectorioActivo,
} from "@/lib/directorio-activo";
import { nombreInicialDesdeUsuarioRed } from "@/lib/nombre-usuario-red";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const identidad = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const next = String(form.get("next") || "/");
  const modo = String(form.get("modo") || "institucional") === "directorio-activo"
    ? "directorio-activo"
    : "institucional";

  const fail = (message: string) => {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", message);
    url.searchParams.set("modo", modo);
    if (next && next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (!identidad || !password) {
    return fail(
      modo === "directorio-activo"
        ? "Usuario y contraseña son obligatorios."
        : "Correo y contraseña son obligatorios."
    );
  }

  const configSeguridad = await getConfiguracionSitio();
  const ventanaMinutos = configSeguridad.loginVentanaMinutos;
  const maxIntentosFallidos = configSeguridad.loginMaxIntentos;
  const intentosFallidosRecientes = await db.registroAuditoria.count({
    where: {
      tipo: "LOGIN_FALLIDO",
      emailIntento: identidad,
      createdAt: { gte: new Date(Date.now() - ventanaMinutos * 60 * 1000) },
    },
  });
  if (intentosFallidosRecientes >= maxIntentosFallidos) {
    return fail(`Demasiados intentos fallidos. Espere ${ventanaMinutos} minutos antes de volver a intentar.`);
  }

  const redirectTo = next && next.startsWith("/") ? next : "/";

  if (modo === "directorio-activo") {
    return ingresarPorDirectorioActivo(req, identidad, password, redirectTo, fail);
  }

  const usuario = await db.usuario.findUnique({ where: { email: identidad }, include: { cargos: true } });

  if (usuario && usuario.directorioActivo) {
    await registrarAuditoria({
      tipo: "LOGIN_FALLIDO",
      descripcion: `"${identidad}" intentó el ingreso con contraseña, pero su cuenta es de directorio activo.`,
      usuarioId: usuario.id,
      emailIntento: identidad,
    });
    return fail('Esta cuenta ingresa por directorio activo CDMB. Elija "Directorio activo CDMB" en el tipo de conexión.');
  }

  if (!usuario || !usuario.activo) {
    const motivo = !usuario
      ? "no existe"
      : usuario.estadoCuenta === "BLOQUEADA"
        ? "bloqueada por intentos fallidos"
        : usuario.estadoCuenta === "SUSPENDIDA"
          ? "suspendida"
          : "inactiva";
    await registrarAuditoria({
      tipo: "LOGIN_FALLIDO",
      descripcion: `Intento de inicio de sesión con correo "${identidad}" (${motivo}).`,
      usuarioId: usuario?.id,
      emailIntento: identidad,
    });
    return fail("Credenciales inválidas.");
  }

  const valido = await verifyPassword(password, usuario.passwordHash);
  if (!valido) {
    await registrarAuditoria({
      tipo: "LOGIN_FALLIDO",
      descripcion: `Contraseña incorrecta para "${identidad}".`,
      usuarioId: usuario.id,
      emailIntento: identidad,
    });
    if (intentosFallidosRecientes + 1 >= maxIntentosFallidos) {
      await db.usuario.update({ where: { id: usuario.id }, data: { activo: false, estadoCuenta: "BLOQUEADA" } });
      await registrarAuditoria({
        tipo: "USUARIO_BLOQUEADO",
        descripcion: `Cuenta "${identidad}" bloqueada automáticamente tras ${intentosFallidosRecientes + 1} intentos fallidos. Un administrador debe habilitarla de nuevo.`,
        usuarioId: usuario.id,
        emailIntento: identidad,
      });
    }
    return fail("Credenciales inválidas.");
  }

  await createSessionCookie({
    userId: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    cargos: usuario.cargos.map((c) => c.nombre),
  });

  await registrarAuditoria({
    tipo: "LOGIN_EXITOSO",
    descripcion: `${usuario.nombre} inició sesión.`,
    usuarioId: usuario.id,
    emailIntento: identidad,
  });

  return NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 });
}

async function ingresarPorDirectorioActivo(
  req: NextRequest,
  usuarioRed: string,
  password: string,
  redirectTo: string,
  fail: (mensaje: string) => NextResponse
) {
  if (!directorioActivoConfigurado()) {
    return fail("La conexión por directorio activo no está habilitada en este servidor.");
  }

  const resultado = await autenticarDirectorioActivo(usuarioRed, password);
  if (!resultado.ok) {
    await registrarAuditoria({
      tipo: "LOGIN_FALLIDO",
      descripcion: `Intento de inicio de sesión por directorio activo con usuario "${usuarioRed}": ${resultado.mensaje}`,
      emailIntento: usuarioRed,
    });
    return fail(resultado.mensaje);
  }

  const existente = await db.usuario.findUnique({ where: { email: usuarioRed }, include: { cargos: true } });

  if (existente && !existente.activo) {
    await registrarAuditoria({
      tipo: "LOGIN_FALLIDO",
      descripcion: `Directorio activo validó a "${usuarioRed}", pero la cuenta está inactiva en la aplicación.`,
      usuarioId: existente.id,
      emailIntento: usuarioRed,
    });
    return fail("Su cuenta está inactiva en la aplicación. Comuníquese con un administrador.");
  }

  let usuario = existente;
  if (!usuario) {
    const nombreInicial = nombreInicialDesdeUsuarioRed(usuarioRed);

    usuario = await db.usuario.create({
      data: {
        email: usuarioRed,
        nombre: nombreInicial,
        passwordHash: "directorio-activo:sin-contrasena-local",
        rol: "FUNCIONARIO",
        directorioActivo: true,
      },
      include: { cargos: true },
    });

    await registrarAuditoria({
      tipo: "USUARIO_CREADO",
      descripcion: `Alta automática de "${usuario.nombre}" (${usuario.email}) por conexión de directorio activo, rol FUNCIONARIO.`,
      usuarioId: usuario.id,
      emailIntento: usuarioRed,
    });
  }

  await createSessionCookie({
    userId: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    cargos: usuario.cargos.map((c) => c.nombre),
  });
  await guardarTokenDirectorioActivo(resultado.token);

  await registrarAuditoria({
    tipo: "LOGIN_EXITOSO",
    descripcion: `${usuario.nombre} inició sesión por conexión de directorio activo CDMB.`,
    usuarioId: usuario.id,
    emailIntento: usuarioRed,
  });

  return NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 });
}
