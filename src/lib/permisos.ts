import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Permisos de acceso ya resueltos para un usuario, listos para consultar con
 * puedeAccederTramite — no hay que volver a tocar Prisma. `tramiteIds` en
 * `null` significa "sin restricción" (ADMIN, o el usuario no tiene Rol de
 * acceso asignado — el caso de todos los usuarios de hoy, para no romper a
 * nadie hasta que un admin le asigne un Rol a propósito). Esto solo aplica
 * dentro de "Trámites ambientales 2.0" — VITAL y SINCA 1.0 quedan abiertos
 * siempre, no tienen restricción por Rol.
 */
export type PermisosUsuario = {
  esAdmin: boolean;
  tramiteIds: Set<string> | null;
};

/**
 * Resuelve los permisos de un usuario desde su Rol de acceso (Usuario.rolPermisosId).
 * Memoizado por request con `cache()` de React, porque varias páginas la
 * consultan por separado dentro del mismo render.
 */
export const obtenerPermisosUsuario = cache(async (userId: string): Promise<PermisosUsuario> => {
  const usuario = await db.usuario.findUnique({
    where: { id: userId },
    select: {
      rol: true,
      rolPermisos: {
        select: { activo: true, todosLosTramites: true, tramites: { select: { tramiteTipoId: true } } },
      },
    },
  });

  const esAdmin = usuario?.rol === "ADMIN";
  if (esAdmin) return { esAdmin: true, tramiteIds: null };

  // Sin Rol asignado, o el Rol quedó desactivado: no se bloquea por un rol que
  // el admin desactivó — mismo criterio que "activo" en Cargo.
  if (!usuario?.rolPermisos || !usuario.rolPermisos.activo) {
    return { esAdmin: false, tramiteIds: null };
  }

  const { todosLosTramites, tramites } = usuario.rolPermisos;
  return {
    esAdmin: false,
    tramiteIds: todosLosTramites ? null : new Set(tramites.map((t) => t.tramiteTipoId)),
  };
});

export function puedeAccederTramite(permisos: PermisosUsuario, tramiteTipoId: string): boolean {
  if (permisos.esAdmin || permisos.tramiteIds === null) return true;
  return permisos.tramiteIds.has(tramiteTipoId);
}

/**
 * Defensa en profundidad para las rutas de API que actúan sobre UN expediente
 * ya existente (avanzar, comentario, documentos, visitas...): además de que la
 * UI oculta el botón, esto bloquea la llamada directa a la API si el usuario
 * no tiene acceso al trámite de ese expediente. `true` si el expediente no
 * existe — el 404 real lo sigue manejando la propia ruta al no encontrarlo.
 */
export async function puedeAccederExpediente(userId: string, expedienteId: string): Promise<boolean> {
  const permisos = await obtenerPermisosUsuario(userId);
  if (permisos.esAdmin || permisos.tramiteIds === null) return true;
  const expediente = await db.expediente.findUnique({ where: { id: expedienteId }, select: { tramiteTipoId: true } });
  if (!expediente) return true;
  return permisos.tramiteIds.has(expediente.tramiteTipoId);
}
