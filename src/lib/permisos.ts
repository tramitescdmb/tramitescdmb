import { cache } from "react";
import { db } from "@/lib/db";
import type { NivelAccesoTramite } from "@prisma/client";

/**
 * Acceso por trámite, ya resuelto para un usuario. A diferencia del cargo o
 * módulo de la app, esto es DENEGADO POR DEFECTO: un FUNCIONARIO sin ninguna
 * fila en `UsuarioTramiteAcceso` para un trámite dado no lo ve. El ADMIN
 * siempre tiene acceso total (VER y EDITAR a todo), sin excepción — es la
 * única cuenta con permiso total mientras no se configure nada más.
 */
export type PermisosUsuario = {
  esAdmin: boolean;
  /** tramiteTipoId → nivel de acceso. Vacío para un FUNCIONARIO sin nada configurado. */
  tramites: Map<string, NivelAccesoTramite>;
};

export const obtenerPermisosUsuario = cache(async (userId: string): Promise<PermisosUsuario> => {
  const usuario = await db.usuario.findUnique({
    where: { id: userId },
    select: { rol: true, tramitesAcceso: { select: { tramiteTipoId: true, nivel: true } } },
  });

  const esAdmin = usuario?.rol === "ADMIN";
  const tramites = new Map<string, NivelAccesoTramite>();
  if (!esAdmin) {
    for (const t of usuario?.tramitesAcceso ?? []) tramites.set(t.tramiteTipoId, t.nivel);
  }
  return { esAdmin, tramites };
});

/** ¿Puede ver (al menos lectura) este trámite? */
export function puedeAccederTramite(permisos: PermisosUsuario, tramiteTipoId: string): boolean {
  return permisos.esAdmin || permisos.tramites.has(tramiteTipoId);
}

/** ¿Puede crear/avanzar/subir documentos en este trámite (no solo verlo)? */
export function puedeEditarTramite(permisos: PermisosUsuario, tramiteTipoId: string): boolean {
  return permisos.esAdmin || permisos.tramites.get(tramiteTipoId) === "EDITAR";
}

/**
 * Defensa en profundidad para las rutas de API que actúan sobre UN expediente
 * ya existente (avanzar, comentario, documentos, visitas...): además de que
 * la UI oculta el formulario, esto bloquea la llamada directa a la API si el
 * usuario no tiene EDITAR sobre el trámite de ese expediente. `true` si el
 * expediente no existe — el 404 real lo sigue manejando la propia ruta.
 */
export async function puedeEditarExpediente(userId: string, expedienteId: string): Promise<boolean> {
  const permisos = await obtenerPermisosUsuario(userId);
  if (permisos.esAdmin) return true;
  const expediente = await db.expediente.findUnique({ where: { id: expedienteId }, select: { tramiteTipoId: true } });
  if (!expediente) return true;
  return puedeEditarTramite(permisos, expediente.tramiteTipoId);
}
