import { cache } from "react";
import { db } from "@/lib/db";
import type { NivelAccesoTramite, SeccionSoloLectura, RolCorrespondencia } from "@prisma/client";
import { getSession, type SessionPayload } from "@/lib/auth";

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
  /** Rol dentro del módulo de correspondencia (SGDEA). null = sin acceso (salvo ADMIN). */
  correspondencia: RolCorrespondencia | null;
  /** Dependencia (oficina) a la que pertenece el funcionario, si tiene. */
  dependenciaId: string | null;
};

type UsuarioFresco = {
  activo: boolean;
  rol: "ADMIN" | "FUNCIONARIO";
  cargos: string[];
  tramitesAcceso: { tramiteTipoId: string; nivel: NivelAccesoTramite }[];
  seccionesAcceso: { seccion: SeccionSoloLectura }[];
  rolCorrespondencia: RolCorrespondencia | null;
  dependenciaId: string | null;
} | null;

/**
 * Lee el usuario fresco de la base UNA vez por solicitud (cache() la dedupe
 * entre obtenerPermisosUsuario y verificarSesion, aunque ambas se llamen por
 * separado). Es la fuente de verdad para todo lo que la cookie de sesión NO
 * puede reflejar al instante: `activo`, `rol` y `cargos` quedan fijos en el
 * JWT desde el login (dura 7 días) — sin esto, desactivar a alguien o
 * cambiarle el rol/cargo no tendría efecto real hasta su próximo login.
 */
const obtenerUsuarioFresco = cache(async (userId: string): Promise<UsuarioFresco> => {
  const usuario = await db.usuario.findUnique({
    where: { id: userId },
    select: {
      activo: true,
      rol: true,
      cargos: { select: { nombre: true } },
      tramitesAcceso: { select: { tramiteTipoId: true, nivel: true } },
      seccionesAcceso: { select: { seccion: true } },
      rolCorrespondencia: true,
      dependenciaId: true,
    },
  });
  if (!usuario) return null;
  return {
    activo: usuario.activo,
    rol: usuario.rol,
    cargos: usuario.cargos.map((c) => c.nombre),
    tramitesAcceso: usuario.tramitesAcceso,
    seccionesAcceso: usuario.seccionesAcceso,
    rolCorrespondencia: usuario.rolCorrespondencia,
    dependenciaId: usuario.dependenciaId,
  };
});

export const obtenerPermisosUsuario = cache(async (userId: string): Promise<PermisosUsuario> => {
  const usuario = await obtenerUsuarioFresco(userId);
  // Una cuenta desactivada se trata como sin ningún acceso, sin importar su
  // rol — defensa en profundidad además de verificarSesion() (que ya
  // debería haber cortado el paso antes de llegar aquí).
  const esAdmin = Boolean(usuario?.activo) && usuario?.rol === "ADMIN";
  const tramites = new Map<string, NivelAccesoTramite>();
  const secciones = new Set<SeccionSoloLectura>();
  if (usuario?.activo && !esAdmin) {
    for (const t of usuario.tramitesAcceso) tramites.set(t.tramiteTipoId, t.nivel);
    for (const s of usuario.seccionesAcceso) secciones.add(s.seccion);
  }
  return {
    esAdmin,
    tramites,
    secciones,
    correspondencia: usuario?.activo ? usuario.rolCorrespondencia : null,
    dependenciaId: usuario?.activo ? usuario.dependenciaId : null,
  };
});

/**
 * Reemplazo de getSession() para todo lo que decide acceso (páginas y rutas
 * de API): además de leer la cookie, confirma contra la base que la cuenta
 * sigue activa y trae el rol/cargos AL DÍA, no la foto de hace hasta 7 días
 * que guarda el JWT. Devuelve null si no hay sesión o si la cuenta fue
 * desactivada mientras tanto — tratar ambos casos igual (como "no hay
 * sesión") es correcto en todos los puntos de entrada existentes, que ya
 * redirigen a /login o devuelven 401 cuando esto es null.
 *
 * getSession() en sí (src/lib/auth.ts) se deja intacto y sin tocar la base:
 * lo usa también el middleware en Edge Runtime, que no puede cargar Prisma.
 */
export const verificarSesion = cache(async (): Promise<SessionPayload | null> => {
  const session = await getSession();
  if (!session) return null;
  const usuario = await obtenerUsuarioFresco(session.userId);
  if (!usuario || !usuario.activo) return null;
  return { userId: session.userId, email: session.email, nombre: session.nombre, rol: usuario.rol, cargos: usuario.cargos };
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
 * "Solicitantes" es un registro maestro compartido entre TODOS los trámites
 * (no está atado a uno en particular) — a diferencia del catálogo o los
 * expedientes, que ya filtran trámite por trámite. Un FUNCIONARIO sin acceso
 * a ningún trámite no tiene por qué poder buscar/ver los datos de contacto
 * de solicitantes de trámites que ni siquiera puede ver.
 */
export function puedeAccederSolicitantes(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.tramites.size > 0;
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

// --- Módulo de correspondencia (SGDEA) ----------------------------------------
// Denegado por defecto, igual que trámites y secciones: sin un rol de
// correspondencia asignado (y sin ser ADMIN) no se entra al módulo.

/** ¿Puede entrar al módulo de correspondencia (ver la bandeja/listado)? */
export function puedeAccederCorrespondencia(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.correspondencia !== null;
}

/** ¿Puede radicar en la ventanilla (operador de ventanilla o admin de archivo)? */
export function puedeRadicar(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.correspondencia === "OPERADOR_VENTANILLA" || permisos.correspondencia === "ADMIN_ARCHIVO";
}

/** ¿Puede repartir/distribuir una comunicación a dependencias/funcionarios? */
export function puedeDistribuir(permisos: PermisosUsuario): boolean {
  return (
    permisos.esAdmin ||
    permisos.correspondencia === "OPERADOR_VENTANILLA" ||
    permisos.correspondencia === "JEFE_DEPENDENCIA" ||
    permisos.correspondencia === "ADMIN_ARCHIVO"
  );
}

/** ¿Puede administrar el archivo (TRD/CCD, dependencias)? */
export function puedeAdministrarArchivo(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.correspondencia === "ADMIN_ARCHIVO";
}
