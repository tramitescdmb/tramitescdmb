import { db } from "@/lib/db";
import {
  abrirSesionServicioDirectorio,
  cerrarSesionDirectorioActivo,
  consultaDirectorioDisponible,
  consultarDirectorioPorDocumento,
  type PerfilDirectorio,
} from "@/lib/directorio-activo";
import { autovincularPerfilesPorDocumento, sincronizarContratistaDeUsuario } from "@/lib/contratacion";

const SIN_CONTRASENA_LOCAL = "directorio-activo:sin-contrasena-local";

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

export async function resolverDependenciaIdPorNombre(nombre: string): Promise<string | null> {
  const buscado = normalizar(nombre);
  if (!buscado) return null;
  const candidatas = await db.dependencia.findMany({ where: { activo: true }, select: { id: true, nombre: true } });
  const coincidencias = candidatas.filter((d) => normalizar(d.nombre) === buscado);
  return coincidencias.length === 1 ? coincidencias[0]!.id : null;
}

export async function actualizarUsuarioDesdeDirectorio(usuarioId: string, perfil: PerfilDirectorio): Promise<string[]> {
  const u = await db.usuario.findUnique({
    where: { id: usuarioId },
    select: { nombres: true, apellidos: true, correoNotificacion: true, celular: true, telefono: true, cedulaONit: true, direccion: true, dependenciaId: true },
  });
  if (!u) return [];
  const datos: Record<string, string> = {};
  const cambios: string[] = [];
  const poner = (campo: string, etiqueta: string, nuevo: string | undefined, actual: string | null) => {
    if (nuevo && nuevo.trim() && nuevo.trim() !== (actual ?? "").trim()) {
      datos[campo] = nuevo.trim();
      cambios.push(etiqueta);
    }
  };
  if (perfil.nombres && perfil.apellidos) {
    poner("nombres", "nombres", perfil.nombres, u.nombres);
    poner("apellidos", "apellidos", perfil.apellidos, u.apellidos);
    if (datos.nombres || datos.apellidos) datos.nombre = `${perfil.nombres} ${perfil.apellidos}`.trim();
  }
  poner("correoNotificacion", "correo", perfil.email?.toLowerCase(), u.correoNotificacion);
  poner("celular", "celular", perfil.celular, u.celular);
  poner("telefono", "teléfono", perfil.telefono, u.telefono);
  poner("direccion", "dirección", perfil.direccion, u.direccion);
  if (!u.cedulaONit && perfil.documento) {
    datos.cedulaONit = perfil.documento;
    cambios.push("cédula");
  }
  let dependenciaId: string | null = null;
  if (perfil.dependencia) {
    dependenciaId = await resolverDependenciaIdPorNombre(perfil.dependencia);
    if (dependenciaId && dependenciaId !== u.dependenciaId) cambios.push("dependencia");
    else dependenciaId = null;
  }
  if (cambios.length === 0) return [];
  await db.usuario.update({ where: { id: usuarioId }, data: { ...datos, ...(dependenciaId ? { dependenciaId } : {}), sincronizadoDirectorioEn: new Date() } });
  await sincronizarContratistaDeUsuario(usuarioId).catch(() => {});
  return cambios;
}

export async function sincronizarUsuarioConDirectorio(usuarioId: string): Promise<{ ok: boolean; mensaje: string }> {
  const u = await db.usuario.findUnique({ where: { id: usuarioId }, select: { cedulaONit: true, contratista: { select: { identificacion: true, tipoPersona: true } } } });
  const documento = u?.cedulaONit ?? (u?.contratista?.tipoPersona === "NATURAL" ? u.contratista.identificacion : null);
  if (!documento) return { ok: false, mensaje: "El usuario no tiene cédula registrada; regístrela para poder consultarlo en el directorio activo." };
  const r = await consultarDirectorioPorDocumento(documento);
  if (!r.ok) return { ok: false, mensaje: r.mensaje };
  const cambios = await actualizarUsuarioDesdeDirectorio(usuarioId, r.perfil);
  await db.usuario.update({ where: { id: usuarioId }, data: { sincronizadoDirectorioEn: new Date() } });
  return { ok: true, mensaje: cambios.length ? `Actualizado desde el directorio activo: ${cambios.join(", ")}.` : "Los datos ya coinciden con el directorio activo." };
}

type ResultadoSincronizacion = { disponible: boolean; revisados: number; actualizados: number; creados: number; vinculados: number; incompleto?: boolean };

export async function sincronizarDirectorioNocturno(): Promise<ResultadoSincronizacion> {
  const vacio = { disponible: false, revisados: 0, actualizados: 0, creados: 0, vinculados: 0 };
  if (!consultaDirectorioDisponible()) return vacio;
  const sesion = await abrirSesionServicioDirectorio();
  if (!sesion.ok) return vacio;
  const limite = Date.now() + 240_000;
  const espera = () => new Promise((r) => setTimeout(r, 300));
  const conteo = { revisados: 0, actualizados: 0, creados: 0, incompleto: false };
  try {
    await refrescarUsuarios(sesion.token, limite, espera, conteo);
    if (!conteo.incompleto) await crearUsuariosDeContratistas(sesion.token, limite, espera, conteo);
  } finally {
    await cerrarSesionDirectorioActivo(sesion.token).catch(() => {});
  }
  const vinculados = await autovincularPerfilesPorDocumento();
  return { disponible: true, ...conteo, vinculados };
}

type Conteo = { revisados: number; actualizados: number; creados: number; incompleto: boolean };

async function refrescarUsuarios(token: string, limite: number, espera: () => Promise<unknown>, conteo: Conteo) {
  const usuarios = await db.usuario.findMany({
    where: { activo: true, cedulaONit: { not: null }, OR: [{ directorioActivo: true }, { contratista: { isNot: null } }] },
    select: { id: true, cedulaONit: true },
    orderBy: { sincronizadoDirectorioEn: { sort: "asc", nulls: "first" } },
  });
  for (const u of usuarios) {
    if (Date.now() > limite) {
      conteo.incompleto = true;
      return;
    }
    const r = await consultarDirectorioPorDocumento(u.cedulaONit!, token);
    conteo.revisados++;
    if (r.ok) {
      if ((await actualizarUsuarioDesdeDirectorio(u.id, r.perfil)).length) conteo.actualizados++;
      else await db.usuario.update({ where: { id: u.id }, data: { sincronizadoDirectorioEn: new Date() } });
    }
    await espera();
  }
}

async function crearUsuariosDeContratistas(token: string, limite: number, espera: () => Promise<unknown>, conteo: Conteo) {
  const pendientes = await db.contratista.findMany({ where: { usuarioId: null, tipoPersona: "NATURAL" }, select: { identificacion: true } });
  for (const c of pendientes) {
    if (Date.now() > limite) {
      conteo.incompleto = true;
      return;
    }
    if (await db.usuario.findFirst({ where: { cedulaONit: c.identificacion }, select: { id: true } })) continue;
    const r = await consultarDirectorioPorDocumento(c.identificacion, token);
    conteo.revisados++;
    await espera();
    if (!r.ok || !r.perfil.usuarioRed) continue;
    const email = r.perfil.usuarioRed.trim().toLowerCase();
    if (await db.usuario.findUnique({ where: { email }, select: { id: true } })) continue;
    const nombre = [r.perfil.nombres, r.perfil.apellidos].filter(Boolean).join(" ") || r.perfil.nombreCompleto || email;
    await db.usuario.create({
      data: {
        email,
        nombre,
        nombres: r.perfil.nombres ?? null,
        apellidos: r.perfil.apellidos ?? null,
        cedulaONit: c.identificacion,
        correoNotificacion: r.perfil.email?.toLowerCase() ?? null,
        celular: r.perfil.celular ?? null,
        directorioActivo: true,
        passwordHash: SIN_CONTRASENA_LOCAL,
        modulosAcceso: ["GECON"],
        sincronizadoDirectorioEn: new Date(),
      },
    });
    conteo.creados++;
  }
}
