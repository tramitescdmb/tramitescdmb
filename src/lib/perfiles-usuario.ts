import type { NivelAccesoTramite, RolContratacion, RolCorrespondencia, SeccionSoloLectura } from "@prisma/client";
import { db } from "@/lib/db";
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

export async function usuariosSinPerfilSgdea(): Promise<{ id: string; nombre: string }[]> {
  const ahora = new Date();
  const candidatos = await db.usuario.findMany({
    where: {
      activo: true,
      rol: { not: "ADMIN" },
      rolCorrespondencia: { not: null },
      modulosAcceso: { has: "SGDEA" },
      OR: [{ rolCorrespondenciaVigenteHasta: null }, { rolCorrespondenciaVigenteHasta: { gte: ahora } }],
    },
    select: {
      id: true,
      nombre: true,
      perfiles: { select: { perfil: { select: { activo: true, permisos: { select: { funcionalidad: true, acciones: true } } } } } },
      excepcionesPermiso: { select: { funcionalidad: true, tipo: true, acciones: true } },
    },
  });
  return candidatos
    .filter((u) => {
      const conceden =
        u.perfiles.some((up) => up.perfil.activo && up.perfil.permisos.some((p) => p.funcionalidad === "sgdea.bandeja" && p.acciones.includes("LEER"))) ||
        u.excepcionesPermiso.some((e) => e.funcionalidad === "sgdea.bandeja" && e.tipo === "CONCEDER" && e.acciones.includes("LEER"));
      const quitan = u.excepcionesPermiso.some((e) => e.funcionalidad === "sgdea.bandeja" && e.tipo === "QUITAR" && e.acciones.includes("LEER"));
      return !conceden || quitan;
    })
    .map((u) => ({ id: u.id, nombre: u.nombre }));
}
