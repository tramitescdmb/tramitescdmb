import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { MODULOS_PERFIL, normalizarMatriz, matricesIguales, type Matriz, type ModuloPerfil } from "@/lib/perfiles-catalogo";
import { PERFILES_SEMILLA, matrizSemilla, type PerfilSemilla } from "@/lib/perfiles-equivalencia";

function filtroUsuariosConRol(semilla: PerfilSemilla): Prisma.UsuarioWhereInput {
  const rol = semilla.rol;
  switch (rol.tipo) {
    case "ADMIN":
      return { activo: true, rol: "ADMIN" };
    case "TRAMITES":
      return { activo: true, rol: { not: "ADMIN" }, tramitesAcceso: { some: { nivel: rol.nivel } } };
    case "CORRESPONDENCIA":
      return { activo: true, rol: { not: "ADMIN" }, rolCorrespondencia: rol.rol };
    case "CONTRATACION":
      return { activo: true, rol: { not: "ADMIN" }, rolesContratacion: { has: rol.rol } };
    case "SECCION":
      return { activo: true, rol: { not: "ADMIN" }, seccionesAcceso: { some: { seccion: rol.seccion } } };
  }
}

function filasPermisos(matriz: Matriz) {
  return Object.entries(matriz).map(([funcionalidad, acciones]) => ({ funcionalidad, acciones }));
}

export async function asegurarPerfilesIniciales(): Promise<void> {
  const existentes = new Set(
    (await db.perfil.findMany({ where: { claveOrigen: { not: null } }, select: { claveOrigen: true } })).map((p) => p.claveOrigen)
  );
  for (const s of PERFILES_SEMILLA) {
    if (existentes.has(s.claveOrigen)) continue;
    await db.perfil.create({
      data: {
        nombre: s.nombre,
        descripcion: s.descripcion,
        modulo: s.modulo,
        claveOrigen: s.claveOrigen,
        permisos: { create: filasPermisos(matrizSemilla(s)) },
      },
    });
  }
}

export function matrizDePerfil(permisos: { funcionalidad: string; acciones: string[] }[]): Matriz {
  return normalizarMatriz(Object.fromEntries(permisos.map((p) => [p.funcionalidad, p.acciones])));
}

const SEMILLA_POR_CLAVE = new Map(PERFILES_SEMILLA.map((s) => [s.claveOrigen, s]));

export async function listarPerfiles() {
  await asegurarPerfilesIniciales();
  const perfiles = await db.perfil.findMany({
    orderBy: [{ modulo: "asc" }, { nombre: "asc" }],
    include: { permisos: true, _count: { select: { usuarios: true } } },
  });
  const conteosRol = await Promise.all(
    perfiles.map((p) => {
      const semilla = p.claveOrigen ? SEMILLA_POR_CLAVE.get(p.claveOrigen) : undefined;
      return semilla ? db.usuario.count({ where: filtroUsuariosConRol(semilla) }) : Promise.resolve(null);
    })
  );
  return perfiles
    .map((p, i) => {
      const matriz = matrizDePerfil(p.permisos);
      const semilla = p.claveOrigen ? SEMILLA_POR_CLAVE.get(p.claveOrigen) : undefined;
      return {
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        modulo: (MODULOS_PERFIL as readonly string[]).includes(p.modulo) ? (p.modulo as ModuloPerfil) : "GENERAL",
        claveOrigen: p.claveOrigen,
        usuariosConRol: conteosRol[i],
        usuariosAsignados: p._count.usuarios,
        acciones: Object.values(matriz).reduce((s, a) => s + a.length, 0),
        modificado: semilla ? !matricesIguales(matriz, matrizSemilla(semilla)) : false,
      };
    })
    .sort((a, b) => MODULOS_PERFIL.indexOf(a.modulo) - MODULOS_PERFIL.indexOf(b.modulo) || a.nombre.localeCompare(b.nombre, "es"));
}

export async function obtenerPerfil(id: string) {
  const p = await db.perfil.findUnique({ where: { id }, include: { permisos: true } });
  if (!p) return null;
  const semilla = p.claveOrigen ? SEMILLA_POR_CLAVE.get(p.claveOrigen) : undefined;
  return {
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    modulo: (MODULOS_PERFIL as readonly string[]).includes(p.modulo) ? (p.modulo as ModuloPerfil) : "GENERAL",
    claveOrigen: p.claveOrigen,
    matriz: matrizDePerfil(p.permisos),
    matrizRolActual: semilla ? matrizSemilla(semilla) : null,
  };
}

export async function guardarPerfil(id: string, datos: { nombre: string; descripcion: string | null; matriz: Record<string, string[]> }) {
  const matriz = normalizarMatriz(datos.matriz);
  await db.$transaction([
    db.perfil.update({ where: { id }, data: { nombre: datos.nombre, descripcion: datos.descripcion } }),
    db.permisoPerfil.deleteMany({ where: { perfilId: id } }),
    db.permisoPerfil.createMany({ data: filasPermisos(matriz).map((f) => ({ ...f, perfilId: id })) }),
  ]);
  return matriz;
}

export async function crearPerfil(datos: { nombre: string; modulo: ModuloPerfil; descripcion: string | null; copiarDeId: string | null }) {
  const base = datos.copiarDeId ? await db.permisoPerfil.findMany({ where: { perfilId: datos.copiarDeId } }) : [];
  return db.perfil.create({
    data: {
      nombre: datos.nombre,
      modulo: datos.modulo,
      descripcion: datos.descripcion,
      permisos: { create: base.map((b) => ({ funcionalidad: b.funcionalidad, acciones: b.acciones })) },
    },
  });
}

export async function eliminarPerfil(id: string) {
  const p = await db.perfil.findUnique({ where: { id }, select: { claveOrigen: true, nombre: true } });
  if (!p) throw new Error("El rol no existe.");
  if (p.claveOrigen) throw new Error("Los roles base no se eliminan.");
  await db.perfil.delete({ where: { id } });
  return p.nombre;
}

export async function asignarRolBase(usuarioId: string, claveOrigen: string): Promise<void> {
  await asegurarPerfilesIniciales();
  const perfil = await db.perfil.findFirst({ where: { claveOrigen, activo: true }, select: { id: true } });
  if (!perfil) return;
  await db.usuarioPerfil.createMany({ data: [{ usuarioId, perfilId: perfil.id }], skipDuplicates: true });
}
