import type { Prisma } from "@prisma/client";
import { obtenerModulosPorPerfil } from "@/lib/permisos";

export async function whereAccesoSgdea(): Promise<Prisma.UsuarioWhereInput> {
  if (!(await obtenerModulosPorPerfil()).includes("SGDEA")) return { OR: [{ rol: "ADMIN" }, { rolCorrespondencia: { not: null } }] };
  return {
    OR: [
      { rol: "ADMIN" },
      { perfiles: { some: { perfil: { activo: true, permisos: { some: { funcionalidad: "sgdea.bandeja", acciones: { has: "LEER" } } } } } } },
      { excepcionesPermiso: { some: { funcionalidad: "sgdea.bandeja", tipo: "CONCEDER", acciones: { has: "LEER" } } } },
    ],
  };
}
