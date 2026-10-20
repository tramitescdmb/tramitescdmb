import type { Prisma, RolContratacion } from "@prisma/client";
import { obtenerModulosPorPerfil } from "@/lib/permisos";

export async function whereDesignacionGecon(rol: RolContratacion): Promise<Prisma.UsuarioWhereInput> {
  if (!(await obtenerModulosPorPerfil()).includes("GECON")) return { rolesContratacion: { has: rol } };
  return { OR: [{ rolesContratacion: { has: rol } }, { perfiles: { some: { perfil: { activo: true, claveOrigen: `GECON:${rol}` } } } }] };
}
