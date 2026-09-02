import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  autenticarDirectorioActivo,
  directorioActivoConfigurado,
  guardarTokenDirectorioActivo,
} from "@/lib/directorio-activo";

const VENTANA_MINUTOS = 15;
const MAX_INTENTOS_FALLIDOS = 5;

/**
 * Único punto de entrada del inicio de sesión. El formulario de /login manda
 * `modo`:
 *   - "institucional"    → contraseña administrada en esta app (tabla Usuario).
 *   - "directorio-activo" → credenciales de la red de la CDMB (API externa,
 *                           ver src/lib/directorio-activo.ts).
 * En ambos casos, si el ingreso es correcto se emite LA MISMA cookie de sesión
 * propia, así el resto de la app no necesita saber cómo entró el funcionario.
 */
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

  // Protección contra fuerza bruta: se apoya en RegistroAuditoria (ya se registraba cada fallo, solo
  // faltaba frenar en base a eso) en vez de un contador en memoria, porque en Vercel cada solicitud
  // puede caer en una instancia distinta — un contador en memoria no serviría de nada ahí.
  const intentosFallidosRecientes = await db.registroAuditoria.count({
    where: {
      tipo: "LOGIN_FALLIDO",
      emailIntento: identidad,
      createdAt: { gte: new Date(Date.now() - VENTANA_MINUTOS * 60 * 1000) },
    },
  });
  if (intentosFallidosRecientes >= MAX_INTENTOS_FALLIDOS) {
    return fail(`Demasiados intentos fallidos. Espere ${VENTANA_MINUTOS} minutos antes de volver a intentar.`);
  }

  const redirectTo = next && next.startsWith("/") ? next : "/";

  if (modo === "directorio-activo") {
    return ingresarPorDirectorioActivo(req, identidad, password, redirectTo, fail);
  }

  // --- Ingreso institucional (contraseña de esta app) -------------------------
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
    await registrarAuditoria({
      tipo: "LOGIN_FALLIDO",
      descripcion: `Intento de inicio de sesión con correo "${identidad}" (${!usuario ? "no existe" : "inactivo"}).`,
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

/**
 * Ingreso validando contra el directorio activo de la CDMB. Da de alta al
 * funcionario en la tabla `Usuario` la primera vez (rol FUNCIONARIO, sin cargo;
 * un ADMIN lo ajusta luego en /usuarios).
 */
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
    const nombreInicial =
      usuarioRed
        .split("@")[0]
        .split(/[.\-_]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ") || usuarioRed;

    usuario = await db.usuario.create({
      data: {
        email: usuarioRed,
        nombre: nombreInicial,
        // Sin contraseña propia: valor centinela que nunca verifica con bcrypt.
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
  // Si el funcionario ya existía (misma persona con cuenta propia) se le deja
  // entrar sin tocar su rol, su cargo ni su marca `directorioActivo`.

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
