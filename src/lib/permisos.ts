import { cache } from "react";
import { db } from "@/lib/db";
import type { NivelAccesoTramite, SeccionSoloLectura } from "@prisma/client";

/**
 * Acceso ya resuelto para un usuario. Tanto los trámites de "Trámites
 * ambientales 2.0" como las secciones de solo lectura (VITAL, SINCA 1.0)
 * están DENEGADOS POR DEFECTO: un FUNCIONARIO sin nada configurado no ve
 * nada de ninguna de las dos. El ADMIN siempre tiene acceso total, sin
 * excepción — es la única cuenta con permiso total mientras no se configure.
 */
export type PermisosUsuario = {
  esAdmin: boolean;
  /** tramiteTipoId → nivel de acceso. Vacío para un FUNCIONARIO sin nada configurado. */
  tramites: Map<string, NivelAccesoTramite>;
  /** VITAL/SINCA 1.0, todo consulta (sin nivel) — vacío para un FUNCIONARIO sin nada configurado. */
  secciones: Set<SeccionSoloLectura>;
};

export const obtenerPermisosUsuario = cache(async (userId: string): Promise<PermisosUsuario> => {
  const usuario = await db.usuario.findUnique({
    where: { id: userId },
    select: {
      rol: true,
      tramitesAcceso: { select: { tramiteTipoId: true, nivel: true } },
      seccionesAcceso: { select: { seccion: true } },
    },
  });

  const esAdmin = usuario?.rol === "ADMIN";
  const tramites = new Map<string, NivelAccesoTramite>();
  const secciones = new Set<SeccionSoloLectura>();
  if (!esAdmin) {
    for (const t of usuario?.tramitesAcceso ?? []) tramites.set(t.tramiteTipoId, t.nivel);
    for (const s of usuario?.seccionesAcceso ?? []) secciones.add(s.seccion);
  }
  return { esAdmin, tramites, secciones };
});

/** ¿Puede ver (al menos lectura) este trámite? */
export function puedeAccederTramite(permisos: PermisosUsuario, tramiteTipoId: string): boolean {
  return permisos.esAdmin || permisos.tramites.has(tramiteTipoId);
}

/** ¿Puede crear/avanzar/subir documentos en este trámite (no solo verlo)? */
export function puedeEditarTramite(permisos: PermisosUsuario, tramiteTipoId: string): boolean {
  return permisos.esAdmin || permisos.tramites.get(tramiteTipoId) === "EDITAR";
}

/** ¿Puede entrar a esta pestaña de VITAL o SINCA 1.0? Todo es solo lectura, no hay nivel. */
export function puedeAccederSeccion(permisos: PermisosUsuario, seccion: SeccionSoloLectura): boolean {
  return permisos.esAdmin || permisos.secciones.has(seccion);
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
