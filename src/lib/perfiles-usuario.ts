import type { ModuloAplicativo, NivelAccesoTramite, RolContratacion, RolCorrespondencia, SeccionSoloLectura } from "@prisma/client";
import { db } from "@/lib/db";
import { sincronizarContratistaDeUsuario, vincularSupervisionesDeUsuario } from "@/lib/contratacion";
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
  const elegidos = await db.perfil.findMany({ where: { id: { in: perfilIds } }, select: { id: true, claveOrigen: true } });
  const geconBase = elegidos.filter((p) => p.claveOrigen?.startsWith("GECON:")).map((p) => p.claveOrigen);
  if (geconBase.includes("GECON:CONTRATISTA") && geconBase.length > 1) {
    throw new Error("El rol Contratista de GECON no se combina con otros roles de GECON.");
  }
  const validos = new Set(elegidos.map((p) => p.id));
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
  await derivarCamposDesdeRoles(usuarioId);
  return { perfiles: validos.size, excepciones: unicas.size };
}

const MODULO_DE_FUNCIONALIDAD: Record<string, string> = { tramites: "TRAMITES", sgdea: "SGDEA", gecon: "GECON", vital: "VITAL", sinca: "SINCA" };
const ORDEN_SGDEA = ["ADMIN_ARCHIVO", "OPERADOR_VENTANILLA", "JEFE_DEPENDENCIA", "FUNCIONARIO_DEPENDENCIA"] as const;

async function derivarCamposDesdeRoles(usuarioId: string) {
  const [asignados, concedidas] = await Promise.all([
    db.usuarioPerfil.findMany({ where: { usuarioId, perfil: { activo: true } }, select: { perfil: { select: { modulo: true, claveOrigen: true } } } }),
    db.excepcionPermisoUsuario.findMany({ where: { usuarioId, tipo: "CONCEDER" }, select: { funcionalidad: true } }),
  ]);
  const claves = new Set(asignados.map((a) => a.perfil.claveOrigen).filter((c): c is string => Boolean(c)));
  const modulos = new Set<string>(asignados.map((a) => a.perfil.modulo).filter((m) => m !== "GENERAL"));
  for (const c of concedidas) {
    const m = MODULO_DE_FUNCIONALIDAD[c.funcionalidad.split(".")[0]!];
    if (m) modulos.add(m);
  }
  const rolSgdea = ORDEN_SGDEA.find((r) => claves.has(`SGDEA:${r}`)) ?? (modulos.has("SGDEA") ? "FUNCIONARIO_DEPENDENCIA" : null);
  const rolesGecon = [...claves].filter((c) => c.startsWith("GECON:")).map((c) => c.slice(6)) as RolContratacion[];
  const secciones = [...claves].filter((c) => c.startsWith("SECCION:")).map((c) => c.slice(8)) as SeccionSoloLectura[];
  await db.$transaction([
    db.usuario.update({
      where: { id: usuarioId },
      data: { modulosAcceso: [...modulos] as ModuloAplicativo[], rolCorrespondencia: rolSgdea, rolesContratacion: rolesGecon },
    }),
    db.usuarioSeccionAcceso.deleteMany({ where: { usuarioId } }),
    db.usuarioSeccionAcceso.createMany({ data: secciones.map((seccion) => ({ usuarioId, seccion })) }),
  ]);
  await sincronizarContratistaDeUsuario(usuarioId);
  await vincularSupervisionesDeUsuario(usuarioId);
}
