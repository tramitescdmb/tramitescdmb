import type { NivelAccesoTramite, RolContratacion, RolCorrespondencia, SeccionSoloLectura } from "@prisma/client";
import { db } from "@/lib/db";
import { construirMatriz } from "@/lib/permisos";
import { asegurarPerfilesIniciales, matrizDePerfil } from "@/lib/perfiles";
import { normalizarMatriz } from "@/lib/perfiles-catalogo";
import type { Excepcion } from "@/lib/perfiles-efectivos";

export type { Excepcion };

export type UsuarioConRoles = {
  rol: "ADMIN" | "FUNCIONARIO";
  tramitesAcceso: { nivel: NivelAccesoTramite }[];
  seccionesAcceso: { seccion: SeccionSoloLectura }[];
  rolCorrespondencia: RolCorrespondencia | null;
  rolesContratacion: RolContratacion[];
};

export function clavesSugeridas(u: UsuarioConRoles): string[] {
  if (u.rol === "ADMIN") return ["ADMIN"];
  const claves: string[] = [];
  if (u.tramitesAcceso.some((t) => t.nivel === "EDITAR")) claves.push("TRAMITES:EDITAR");
  else if (u.tramitesAcceso.length > 0) claves.push("TRAMITES:VER");
  if (u.rolCorrespondencia) claves.push(`SGDEA:${u.rolCorrespondencia}`);
  for (const r of u.rolesContratacion) claves.push(`GECON:${r}`);
  for (const s of u.seccionesAcceso) claves.push(`SECCION:${s.seccion}`);
  return claves;
}

const SELECT_ROLES = {
  rol: true,
  tramitesAcceso: { select: { nivel: true } },
  seccionesAcceso: { select: { seccion: true } },
  rolCorrespondencia: true,
  rolesContratacion: true,
} as const;

export async function obtenerPerfilesDeUsuario(usuarioId: string) {
  await asegurarPerfilesIniciales();
  const [usuario, perfiles, asignados, excepciones] = await Promise.all([
    db.usuario.findUnique({ where: { id: usuarioId }, select: SELECT_ROLES }),
    db.perfil.findMany({ where: { activo: true }, include: { permisos: true }, orderBy: { nombre: "asc" } }),
    db.usuarioPerfil.findMany({ where: { usuarioId }, select: { perfilId: true } }),
    db.excepcionPermisoUsuario.findMany({ where: { usuarioId } }),
  ]);
  if (!usuario) return null;
  const sugeridas = new Set(clavesSugeridas(usuario));
  return {
    perfiles: perfiles.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      modulo: p.modulo,
      descripcion: p.descripcion,
      sugerido: p.claveOrigen ? sugeridas.has(p.claveOrigen) : false,
      matriz: matrizDePerfil(p.permisos),
    })),
    asignados: asignados.map((a) => a.perfilId),
    excepciones: excepciones.map((e) => ({
      funcionalidad: e.funcionalidad,
      tipo: e.tipo,
      acciones: normalizarMatriz({ [e.funcionalidad]: e.acciones })[e.funcionalidad] ?? [],
      motivo: e.motivo,
    })),
  };
}

export async function guardarPerfilesDeUsuario(usuarioId: string, perfilIds: string[], excepciones: Excepcion[]) {
  const validos = new Set((await db.perfil.findMany({ where: { id: { in: perfilIds } }, select: { id: true } })).map((p) => p.id));
  const limpias = excepciones
    .map((e) => ({ ...e, acciones: normalizarMatriz({ [e.funcionalidad]: e.acciones })[e.funcionalidad] ?? [] }))
    .filter((e) => e.acciones.length > 0 && (e.tipo === "CONCEDER" || e.tipo === "QUITAR"));
  const unicas = new Map(limpias.map((e) => [`${e.funcionalidad}|${e.tipo}`, e]));
  await db.$transaction([
    db.usuarioPerfil.deleteMany({ where: { usuarioId } }),
    db.usuarioPerfil.createMany({ data: [...validos].map((perfilId) => ({ usuarioId, perfilId })) }),
    db.excepcionPermisoUsuario.deleteMany({ where: { usuarioId } }),
    db.excepcionPermisoUsuario.createMany({
      data: [...unicas.values()].map((e) => ({ usuarioId, funcionalidad: e.funcionalidad, tipo: e.tipo, acciones: e.acciones, motivo: e.motivo })),
    }),
  ]);
  return { perfiles: validos.size, excepciones: unicas.size };
}

export async function asignarPerfilesSegunRoles(): Promise<{ usuarios: number; asignaciones: number }> {
  await asegurarPerfilesIniciales();
  const [usuarios, perfiles] = await Promise.all([
    db.usuario.findMany({ where: { activo: true }, select: { id: true, ...SELECT_ROLES } }),
    db.perfil.findMany({ where: { claveOrigen: { not: null } }, select: { id: true, claveOrigen: true } }),
  ]);
  const porClave = new Map(perfiles.map((p) => [p.claveOrigen!, p.id]));
  const filas = usuarios.flatMap((u) => clavesSugeridas(u).flatMap((c) => (porClave.has(c) ? [{ usuarioId: u.id, perfilId: porClave.get(c)! }] : [])));
  const r = await db.usuarioPerfil.createMany({ data: filas, skipDuplicates: true });
  return { usuarios: new Set(filas.map((f) => f.usuarioId)).size, asignaciones: r.count };
}

type Requisito = [string, string];

function requisitosLegados(
  modulo: string,
  u: {
    rolCorrespondencia: string | null;
    rolesContratacion: string[];
    tramitesAcceso: { nivel: string }[];
    seccionesAcceso: { seccion: string }[];
  }
): Requisito[] {
  switch (modulo) {
    case "SGDEA":
      return u.rolCorrespondencia ? [["sgdea.bandeja", "LEER"]] : [];
    case "GECON":
      return u.rolesContratacion.length > 0 ? [["gecon.acceso", "LEER"]] : [];
    case "TRAMITES": {
      const r: Requisito[] = u.tramitesAcceso.length > 0 ? [["tramites.expedientes", "LEER"]] : [];
      if (u.tramitesAcceso.some((t) => t.nivel === "EDITAR")) r.push(["tramites.expedientes", "ACTUALIZAR"]);
      return r;
    }
    case "VITAL":
    case "SINCA": {
      const mapa: Record<string, string> = {
        VITAL_BASE: "vital.solicitudes",
        VITAL_DASHBOARD: "vital.tablero",
        SINCA_BASE: "sinca.solicitudes",
        SINCA_DASHBOARD: "sinca.tablero",
        SINCA_MINERIA: "sinca.mineria",
      };
      return u.seccionesAcceso.filter((x) => x.seccion.startsWith(`${modulo}_`)).map((x) => [mapa[x.seccion]!, "LEER"] as Requisito);
    }
    default:
      return [];
  }
}

export async function usuariosSinPerfil(modulo: string): Promise<{ id: string; nombre: string; falta: string[] }[]> {
  const ahora = new Date();
  const candidatos = await db.usuario.findMany({
    where: { activo: true, rol: { not: "ADMIN" }, modulosAcceso: { has: modulo as never } },
    select: {
      id: true,
      nombre: true,
      rolCorrespondencia: true,
      rolCorrespondenciaVigenteHasta: true,
      rolesContratacion: true,
      rolContratacionVigenteHasta: true,
      tramitesAcceso: { select: { nivel: true } },
      seccionesAcceso: { select: { seccion: true } },
      perfiles: { select: { perfil: { select: { activo: true, permisos: { select: { funcionalidad: true, acciones: true } } } } } },
      excepcionesPermiso: { select: { funcionalidad: true, tipo: true, acciones: true } },
    },
  });
  const salida: { id: string; nombre: string; falta: string[] }[] = [];
  for (const u of candidatos) {
    if (modulo === "SGDEA" && u.rolCorrespondenciaVigenteHasta && u.rolCorrespondenciaVigenteHasta < ahora) continue;
    if (modulo === "GECON" && u.rolContratacionVigenteHasta && u.rolContratacionVigenteHasta < ahora) continue;
    const requisitos = requisitosLegados(modulo, u);
    if (requisitos.length === 0) continue;
    const matriz = construirMatriz(
      u.perfiles.filter((up) => up.perfil.activo).flatMap((up) => up.perfil.permisos),
      u.excepcionesPermiso
    );
    const falta = requisitos.filter(([f, a]) => !matriz.get(f)?.has(a)).map(([f, a]) => `${f}:${a}`);
    if (falta.length > 0) salida.push({ id: u.id, nombre: u.nombre, falta });
  }
  return salida;
}

export async function usuariosSinPerfilSgdea() {
  return usuariosSinPerfil("SGDEA");
}
