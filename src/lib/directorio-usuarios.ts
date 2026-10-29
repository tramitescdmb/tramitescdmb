import { db } from "@/lib/db";
import {
  abrirSesionServicioDirectorio,
  cerrarSesionDirectorioActivo,
  consultaDirectorioDisponible,
  listarDirectorioCompleto,
  type PerfilDirectorio,
} from "@/lib/directorio-activo";
import { autovincularPerfilesPorDocumento, sincronizarContratistaDeUsuario } from "@/lib/contratacion";
import { registrarAuditoria } from "@/lib/auditoria";

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

export type IndiceDirectorio = { porDocumento: Map<string, PerfilDirectorio>; porUsuarioRed: Map<string, PerfilDirectorio>; porCorreo: Map<string, PerfilDirectorio> };

export function indexarDirectorio(perfiles: PerfilDirectorio[]): IndiceDirectorio {
  const indice: IndiceDirectorio = { porDocumento: new Map(), porUsuarioRed: new Map(), porCorreo: new Map() };
  for (const p of perfiles) {
    const doc = p.documento?.replace(/\D/g, "");
    if (doc) indice.porDocumento.set(doc, p);
    if (p.usuarioRed) indice.porUsuarioRed.set(p.usuarioRed.trim().toLowerCase(), p);
    if (p.email) indice.porCorreo.set(p.email.trim().toLowerCase(), p);
  }
  return indice;
}

type UsuarioParaCruce = {
  email: string;
  directorioActivo: boolean;
  cedulaONit: string | null;
  correoNotificacion: string | null;
  contratista: { identificacion: string; tipoPersona: string } | null;
};

export function cruzarUsuarioConDirectorio(u: UsuarioParaCruce, indice: IndiceDirectorio): { perfil: PerfilDirectorio; por: "cedula" | "usuarioRed" | "correo" } | null {
  const documento = (u.cedulaONit ?? (u.contratista?.tipoPersona === "NATURAL" ? u.contratista.identificacion : null))?.replace(/\D/g, "");
  if (documento && indice.porDocumento.has(documento)) return { perfil: indice.porDocumento.get(documento)!, por: "cedula" };
  const login = u.email.trim().toLowerCase();
  if (u.directorioActivo && indice.porUsuarioRed.has(login)) return { perfil: indice.porUsuarioRed.get(login)!, por: "usuarioRed" };
  for (const correo of [u.correoNotificacion, login.includes("@") ? login : null]) {
    const c = correo?.trim().toLowerCase();
    if (c && indice.porCorreo.has(c)) return { perfil: indice.porCorreo.get(c)!, por: "correo" };
  }
  return null;
}

async function convertirCuentaTemporal(usuarioId: string, perfil: PerfilDirectorio): Promise<string | null> {
  const usuarioRed = perfil.usuarioRed?.trim().toLowerCase();
  if (!usuarioRed) return null;
  const ocupado = await db.usuario.findFirst({ where: { email: usuarioRed, NOT: { id: usuarioId } }, select: { id: true } });
  if (ocupado) return null;
  const antes = await db.usuario.findUnique({ where: { id: usuarioId }, select: { email: true, nombre: true } });
  await db.usuario.update({
    where: { id: usuarioId },
    data: { email: usuarioRed, directorioActivo: true, cuentaTemporal: false, passwordHash: SIN_CONTRASENA_LOCAL, passwordCambiadaEn: null, sincronizadoDirectorioEn: new Date() },
  });
  await registrarAuditoria({
    tipo: "USUARIO_ACTUALIZADO",
    descripcion: `La cuenta temporal de ${antes?.nombre ?? "un usuario"} (${antes?.email ?? ""}) pasó al directorio activo con el usuario de red ${usuarioRed}: desde ahora ingresa con la contraseña del dominio.`,
  });
  return usuarioRed;
}

const SELECT_CRUCE = {
  id: true,
  email: true,
  rol: true,
  directorioActivo: true,
  cuentaTemporal: true,
  cedulaONit: true,
  correoNotificacion: true,
  contratista: { select: { identificacion: true, tipoPersona: true } },
} as const;

async function aplicarDirectorio(
  u: UsuarioParaCruce & { id: string; rol: string; cuentaTemporal: boolean },
  coincidencia: { perfil: PerfilDirectorio; por: "cedula" | "usuarioRed" | "correo" },
): Promise<{ cambios: string[]; usuarioRed: string | null }> {
  const cambios = await actualizarUsuarioDesdeDirectorio(u.id, coincidencia.perfil);
  const usuarioRed = u.cuentaTemporal && coincidencia.por === "cedula" && u.rol !== "ADMIN" ? await convertirCuentaTemporal(u.id, coincidencia.perfil) : null;
  if (!cambios.length && !usuarioRed) await db.usuario.update({ where: { id: u.id }, data: { sincronizadoDirectorioEn: new Date() } });
  return { cambios, usuarioRed };
}

export async function sincronizarUsuarioConDirectorio(usuarioId: string): Promise<{ ok: boolean; mensaje: string }> {
  const u = await db.usuario.findUnique({ where: { id: usuarioId }, select: SELECT_CRUCE });
  if (!u) return { ok: false, mensaje: "El usuario no existe." };
  const lista = await listarDirectorioCompleto();
  if (!lista.ok) return { ok: false, mensaje: lista.mensaje };
  const coincidencia = cruzarUsuarioConDirectorio(u, indexarDirectorio(lista.perfiles));
  if (!coincidencia) {
    return { ok: false, mensaje: "No se encontró en el directorio activo por cédula, usuario de red ni correo. Si es una cuenta temporal, se actualizará sola cuando exista en el dominio." };
  }
  const { cambios, usuarioRed } = await aplicarDirectorio(u, coincidencia);
  const partes = [
    usuarioRed ? `La cuenta temporal pasó al dominio con el usuario de red ${usuarioRed}.` : null,
    cambios.length ? `Actualizado desde el directorio activo: ${cambios.join(", ")}.` : null,
  ].filter(Boolean);
  return { ok: true, mensaje: partes.join(" ") || "Los datos ya coinciden con el directorio activo." };
}

type ResultadoSincronizacion = {
  ok: boolean;
  disponible: boolean;
  enDirectorio: number;
  revisados: number;
  encontrados: number;
  actualizados: number;
  convertidos: number;
  creados: number;
  vinculados: number;
  mensaje?: string;
};

export async function sincronizarDirectorioNocturno(): Promise<ResultadoSincronizacion> {
  const vacio = { disponible: false, enDirectorio: 0, revisados: 0, encontrados: 0, actualizados: 0, convertidos: 0, creados: 0, vinculados: 0 };
  if (!consultaDirectorioDisponible()) return { ok: true, ...vacio };
  const sesion = await abrirSesionServicioDirectorio();
  if (!sesion.ok) return { ok: false, ...vacio, mensaje: sesion.mensaje };
  let lista: Awaited<ReturnType<typeof listarDirectorioCompleto>>;
  try {
    lista = await listarDirectorioCompleto(sesion.token);
  } finally {
    await cerrarSesionDirectorioActivo(sesion.token).catch(() => {});
  }
  if (!lista.ok) return { ok: false, ...vacio, mensaje: lista.mensaje };
  const indice = indexarDirectorio(lista.perfiles);
  const r = { ok: true, disponible: true, enDirectorio: lista.perfiles.length, revisados: 0, encontrados: 0, actualizados: 0, convertidos: 0, creados: 0, vinculados: 0 };

  const usuarios = await db.usuario.findMany({ where: { activo: true }, select: SELECT_CRUCE });
  for (const u of usuarios) {
    r.revisados++;
    const coincidencia = cruzarUsuarioConDirectorio(u, indice);
    if (!coincidencia) continue;
    r.encontrados++;
    const { cambios, usuarioRed } = await aplicarDirectorio(u, coincidencia);
    if (cambios.length) r.actualizados++;
    if (usuarioRed) r.convertidos++;
  }

  const pendientes = await db.contratista.findMany({ where: { usuarioId: null, tipoPersona: "NATURAL" }, select: { identificacion: true } });
  for (const c of pendientes) {
    const perfil = indice.porDocumento.get(c.identificacion.replace(/\D/g, ""));
    if (!perfil?.usuarioRed) continue;
    if (await db.usuario.findFirst({ where: { cedulaONit: c.identificacion }, select: { id: true } })) continue;
    if (await crearUsuarioDeDominio(perfil, c.identificacion, ["GECON"])) r.creados++;
  }
  r.vinculados = await autovincularPerfilesPorDocumento();
  return r;
}

export async function crearUsuarioDeDominio(perfil: PerfilDirectorio, documento: string, modulos: ("GECON" | "TRAMITES" | "SGDEA")[]): Promise<{ id: string; email: string } | null> {
  const email = perfil.usuarioRed?.trim().toLowerCase();
  if (!email || (await db.usuario.findUnique({ where: { email }, select: { id: true } }))) return null;
  const nombre = [perfil.nombres, perfil.apellidos].filter(Boolean).join(" ") || perfil.nombreCompleto || email;
  return db.usuario.create({
    data: {
      email,
      nombre,
      nombres: perfil.nombres ?? null,
      apellidos: perfil.apellidos ?? null,
      cedulaONit: documento,
      correoNotificacion: perfil.email?.toLowerCase() ?? null,
      celular: perfil.celular ?? null,
      telefono: perfil.telefono ?? null,
      direccion: perfil.direccion ?? null,
      directorioActivo: true,
      passwordHash: SIN_CONTRASENA_LOCAL,
      modulosAcceso: modulos,
      sincronizadoDirectorioEn: new Date(),
    },
    select: { id: true, email: true },
  });
}
