import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionCookie } from "@/lib/auth";
import {
  autenticarDirectorioActivo,
  directorioActivoConfigurado,
  guardarTokenDirectorioActivo,
} from "@/lib/directorio-activo";
import { registrarAuditoria } from "@/lib/auditoria";

/**
 * "Conexión por directorio activo CDMB".
 *
 * Valida las credenciales contra el API de directorio activo de la Corporación
 * (ver src/lib/directorio-activo.ts) en vez de contra la tabla `Usuario`. Si son
 * correctas:
 *   1. Se da de alta al funcionario en la tabla `Usuario` la primera vez
 *      (rol FUNCIONARIO, sin cargo; un ADMIN lo ajusta luego en /usuarios).
 *   2. Se emite LA MISMA cookie de sesión propia que el login normal, para que
 *      el resto de la app no necesite saber cómo entró el funcionario.
 *   3. Se guarda el token del API en una cookie aparte, solo para poder cerrar
 *      sesión también en el directorio activo (DELETE /admin/logout).
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const usuarioRed = String(form.get("usuario") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const next = String(form.get("next") || "/");

  const fail = (message: string) => {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", message);
    url.searchParams.set("modo", "directorio-activo");
    if (next && next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (!directorioActivoConfigurado()) {
    return fail("La conexión por directorio activo no está habilitada en este entorno.");
  }
  if (!usuarioRed || !password) {
    return fail("Usuario y contraseña son obligatorios.");
  }

  // Misma protección contra fuerza bruta que el login normal, apoyada en
  // RegistroAuditoria (en Vercel un contador en memoria no serviría).
  const VENTANA_MINUTOS = 15;
  const MAX_INTENTOS_FALLIDOS = 5;
  const intentosFallidosRecientes = await db.registroAuditoria.count({
    where: {
      tipo: "LOGIN_FALLIDO",
      emailIntento: usuarioRed,
      createdAt: { gte: new Date(Date.now() - VENTANA_MINUTOS * 60 * 1000) },
    },
  });
  if (intentosFallidosRecientes >= MAX_INTENTOS_FALLIDOS) {
    return fail(`Demasiados intentos fallidos. Espere ${VENTANA_MINUTOS} minutos antes de volver a intentar.`);
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

  // Alta / actualización del funcionario en la tabla local.
  const existente = await db.usuario.findUnique({ where: { email: usuarioRed }, include: { cargo: true } });

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
    // Nombre inicial a partir del usuario de red; un ADMIN lo corrige en /usuarios.
    const nombreInicial = usuarioRed
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
      include: { cargo: true },
    });

    await registrarAuditoria({
      tipo: "USUARIO_CREADO",
      descripcion: `Alta automática de "${usuario.nombre}" (${usuario.email}) por conexión de directorio activo, rol FUNCIONARIO.`,
      usuarioId: usuario.id,
      emailIntento: usuarioRed,
    });
  }
  // Si el funcionario ya existía (cuenta con contraseña propia y la misma
  // persona) se le deja iniciar sesión sin tocar su rol, su cargo ni su
  // marca `directorioActivo`: podrá seguir usando cualquiera de las dos vías.

  await createSessionCookie({
    userId: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    cargo: usuario.cargo?.nombre ?? null,
  });
  await guardarTokenDirectorioActivo(resultado.token);

  await registrarAuditoria({
    tipo: "LOGIN_EXITOSO",
    descripcion: `${usuario.nombre} inició sesión por conexión de directorio activo CDMB.`,
    usuarioId: usuario.id,
    emailIntento: usuarioRed,
  });

  const redirectTo = next && next.startsWith("/") ? next : "/";
  return NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 });
}
