import { db } from "@/lib/db";

/** Dependencias activas para los desplegables (ventanilla, distribución). */
export async function listarDependenciasActivas() {
  return db.dependencia.findMany({
    where: { activo: true },
    orderBy: [{ nivel: "asc" }, { orden: "asc" }, { nombre: "asc" }],
    select: { id: true, codigo: true, nombre: true, parentId: true, nivel: true },
  });
}

/** Todas las dependencias (incluye inactivas) para el admin. */
export async function listarDependencias() {
  return db.dependencia.findMany({
    orderBy: [{ nivel: "asc" }, { orden: "asc" }, { nombre: "asc" }],
    include: {
      responsable: { select: { nombre: true } },
      _count: { select: { usuarios: true, comunicacionesDestino: true } },
    },
  });
}
