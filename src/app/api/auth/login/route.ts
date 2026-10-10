import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { registrarAuditoria } from "@/lib/auditoria";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import {
  autenticarDirectorioActivo,
  directorioActivoConfigurado,
  guardarTokenDirectorioActivo,
  type PerfilDirectorio,
} from "@/lib/directorio-activo";
import { sincronizarContratistaDeUsuario } from "@/lib/contratacion";
import { nombreInicialDesdeUsuarioRed } from "@/lib/nombre-usuario-red";

type UsuarioConCargos = Prisma.UsuarioGetPayload<{ include: { cargos: true } }>;

/**
 * Busca, entre las dependencias activas, una cuyo nombre coincida (sin mayúsculas/tildes ni
 * espacios de más) con lo que entregó el directorio activo. Solo se usa para RELLENAR un campo
 * vacío — nunca crea una dependencia nueva ni reemplaza la que ya tenga asignada el usuario, para
 * no inventar registros a partir de un nombre mal escrito o abreviado distinto en el directorio.
 */
async function resolverDependenciaIdPorNombre(nombre: string): Promise<string | null> {
  const normalizado = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
  if (!normalizado) return null;
  const candidatas = await db.dependencia.findMany({ where: { activo: true }, select: { id: true, nombre: true } });
  const coincidencias = candidatas.filter(
    (d) =>
      d.nombre
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim()
        .toLowerCase() === normalizado
  );
  return coincidencias.length === 1 ? coincidencias[0]!.id : null;
}

async function completarDesdeDirectorio(usuario: UsuarioConCargos, perfil: PerfilDirectorio): Promise<UsuarioConCargos> {
  const datos: Record<string, string> = {};
  const sinNombre = !usuario.nombres?.trim() && !usuario.apellidos?.trim() && !usuario.razonSocial?.trim();
  if (sinNombre && perfil.nombres && perfil.apellidos) {
    datos.nombres = perfil.nombres;
    datos.apellidos = perfil.apellidos;
    datos.nombre = `${perfil.nombres} ${perfil.apellidos}`;
  }
  if (!usuario.correoNotificacion && perfil.email) datos.correoNotificacion = perfil.email.toLowerCase();
  if (!usuario.celular && perfil.celular) datos.celular = perfil.celular;
  if (!usuario.telefono && perfil.telefono) datos.telefono = perfil.telefono;
  if (!usuario.cedulaONit && perfil.documento) datos.cedulaONit = perfil.documento;
  if (!usuario.direccion && perfil.direccion) datos.direccion = perfil.direccion;
  let dependenciaId: string | undefined;
  if (!usuario.dependenciaId && perfil.dependencia) {
    dependenciaId = (await resolverDependenciaIdPorNombre(perfil.dependencia)) ?? undefined;
  }
  if (Object.keys(datos).length === 0 && !dependenciaId) return usuario;
  const actualizado = await db.usuario.update({
    where: { id: usuario.id },
    data: { ...datos, ...(dependenciaId ? { dependenciaId } : {}) },
    include: { cargos: true },
  });
  await sincronizarContratistaDeUsuario(usuario.id).catch(() => {});
  return actualizado;
}

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

  const perfil = resultado.perfil;
  let usuario = existente;
  if (!usuario) {
    const nombreInicial =
      [perfil.nombres, perfil.apellidos].filter(Boolean).join(" ") || perfil.nombreCompleto || nombreInicialDesdeUsuarioRed(usuarioRed);

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

  usuario = await completarDesdeDirectorio(usuario, perfil);

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
