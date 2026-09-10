import { cache } from "react";
import { db } from "@/lib/db";
import type { NivelAccesoTramite, SeccionSoloLectura, RolCorrespondencia } from "@prisma/client";
import { getSession, type SessionPayload } from "@/lib/auth";
import { getConfiguracionSitio } from "@/lib/config-sitio";

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
  /** ¿Puede firmar electrónicamente? ADMIN siempre; un funcionario según `Usuario.accesoFirma`. */
  puedeFirmar: boolean;
};

type UsuarioFresco = {
  activo: boolean;
  rol: "ADMIN" | "FUNCIONARIO";
  cargos: string[];
  tramitesAcceso: { tramiteTipoId: string; nivel: NivelAccesoTramite }[];
  seccionesAcceso: { seccion: SeccionSoloLectura }[];
  rolCorrespondencia: RolCorrespondencia | null;
  rolCorrespondenciaVigenteHasta: Date | null;
  dependenciaId: string | null;
  accesoFirma: boolean;
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
      rolCorrespondenciaVigenteHasta: true,
      dependenciaId: true,
      accesoFirma: true,
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
    rolCorrespondenciaVigenteHasta: usuario.rolCorrespondenciaVigenteHasta,
    dependenciaId: usuario.dependenciaId,
    accesoFirma: usuario.accesoFirma,
  };
});

export const obtenerPermisosUsuario = cache(async (userId: string): Promise<PermisosUsuario> => {
  const [usuario, config] = await Promise.all([obtenerUsuarioFresco(userId), getConfiguracionSitio()]);
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
  // MoReq 6.3: un rol con vigencia vencida se trata como si no estuviera asignado, sin que un ADMIN tenga
  // que volver a entrar a quitarlo — se evalúa en cada solicitud, así que no hace falta un job programado.
  const rolVencido = Boolean(usuario?.rolCorrespondenciaVigenteHasta && usuario.rolCorrespondenciaVigenteHasta < new Date());
  // "Locker" del SGDEA: mientras `sgdeaVisibleFuncionarios` esté en false, para todos menos ADMIN
  // es como no tener rol de correspondencia — no ven el módulo ni pueden llamar a sus APIs.
  const sgdeaOculto = !config.sgdeaVisibleFuncionarios && !esAdmin;
  return {
    esAdmin,
    tramites,
    secciones,
    correspondencia: usuario?.activo && !rolVencido && !sgdeaOculto ? usuario.rolCorrespondencia : null,
    dependenciaId: usuario?.activo ? usuario.dependenciaId : null,
    puedeFirmar: esAdmin || Boolean(usuario?.activo && usuario.accesoFirma),
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

/**
 * ¿Puede registrar el DESPACHO efectivo de un oficio de salida (que ya se envió
 * de verdad al destinatario por correo/físico)? Es la ventanilla de salida /
 * gestión documental — el mismo grupo que radica en ventanilla. Ni el funcionario
 * asignado ni quien redactó el borrador despachan: el envío efectivo del oficio
 * al peticionario es responsabilidad de la ventanilla.
 */
export function puedeDespachar(permisos: PermisosUsuario): boolean {
  return puedeRadicar(permisos);
}

/**
 * ¿Puede firmar electrónicamente un oficio o memorando? Requiere acceso al
 * módulo y que el ADMIN no le haya retirado el acceso a firma (Usuario.accesoFirma).
 * A diferencia de radicar, no depende del rol de correspondencia — cualquier
 * funcionario del módulo puede co-firmar.
 */
export function puedeFirmar(permisos: PermisosUsuario): boolean {
  return puedeAccederCorrespondencia(permisos) && permisos.puedeFirmar;
}

/**
 * ¿Puede repartir/distribuir una comunicación a dependencias/funcionarios? La
 * ventanilla (OPERADOR_VENTANILLA) y, como supervisión, el rol de archivo y el
 * admin. El jefe de dependencia NO reparte: el reparto está centralizado en la
 * ventanilla. También gobierna la vista de metadatos/palabras clave/nivel de
 * acceso y el detener/reanudar el término desde el detalle — la ventanilla ve
 * toda la información del radicado; lo único que NO ve es el espacio para
 * redactar la respuesta (eso es del funcionario al que se le repartió).
 */
export function puedeDistribuir(permisos: PermisosUsuario): boolean {
  return (
    permisos.esAdmin ||
    permisos.correspondencia === "OPERADOR_VENTANILLA" ||
    permisos.correspondencia === "ADMIN_ARCHIVO"
  );
}

/**
 * ¿Puede DEVOLVER a la ventanilla una recibida que le repartieron (indicando por
 * qué no le corresponde)? Solo el/los funcionario(s) del reparto vigente, y solo
 * si NO es quien reparte (la ventanilla no se devuelve a sí misma; re-reparte).
 * La regla de los "3 días hábiles antes del vencimiento" se valida en el dominio,
 * no aquí.
 */
export function puedeDevolverReparto(
  permisos: PermisosUsuario,
  usuarioId: string,
  distribucionesVigentes: { usuarioId: string | null; dependenciaId: string | null }[]
): boolean {
  if (puedeDistribuir(permisos)) return false;
  return distribucionesVigentes.some((d) =>
    d.usuarioId
      ? d.usuarioId === usuarioId
      : Boolean(d.dependenciaId) && d.dependenciaId === permisos.dependenciaId
  );
}

/** ¿Puede administrar el archivo (TRD/CCD, dependencias)? */
export function puedeAdministrarArchivo(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.correspondencia === "ADMIN_ARCHIVO";
}

/**
 * ¿Puede escribir/editar el borrador de respuesta de una RECIBIDA que le fue
 * repartida? Solo el/los funcionario(s) de la distribución VIGENTE (por usuario o
 * por su dependencia) — es SU tarea, no la de la ventanilla ni la del archivo. El
 * borrador no radica nada; radicarlo como oficio de salida sigue exigiendo
 * `puedeRadicar`, y despacharlo `puedeDespachar`. El ADMIN mantiene el acceso como
 * superusuario. Recibe la lista de repartos vigentes (puede haber varios).
 */
export function puedeResponderComoAsignado(
  permisos: PermisosUsuario,
  usuarioId: string,
  distribucionesVigentes: { usuarioId: string | null; dependenciaId: string | null }[]
): boolean {
  if (!puedeAccederCorrespondencia(permisos)) return false;
  if (permisos.esAdmin) return true;
  return distribucionesVigentes.some((d) =>
    d.usuarioId
      ? d.usuarioId === usuarioId
      : Boolean(d.dependenciaId) && d.dependenciaId === permisos.dependenciaId
  );
}

/**
 * ¿Puede abrir o subir documentos a un expediente documental DE ESTA
 * dependencia? Cualquier funcionario con acceso al módulo puede hacerlo para
 * su propia dependencia (así como gestiona sus propios documentos del día a
 * día) — el administrador de archivo puede hacerlo para cualquiera.
 */
export function puedeGestionarExpedienteDeDependencia(permisos: PermisosUsuario, dependenciaId: string): boolean {
  if (!puedeAccederCorrespondencia(permisos)) return false;
  if (permisos.esAdmin || permisos.correspondencia === "ADMIN_ARCHIVO") return true;
  return permisos.dependenciaId === dependenciaId;
}

/** ¿Puede VER un expediente con este nivel de acceso (Ley 1712/2014, arts. 18-19)? Pública: cualquiera
 * con acceso a correspondencia. Clasificada/reservada: solo quien puede gestionar expedientes de esa
 * dependencia (propia dependencia, o ADMIN_ARCHIVO/admin) — el nivel deja de ser solo una etiqueta. */
export function puedeVerNivelAccesoExpediente(
  permisos: PermisosUsuario,
  expediente: { nivelAcceso: string; dependenciaId: string }
): boolean {
  if (expediente.nivelAcceso === "PUBLICA") return puedeAccederCorrespondencia(permisos);
  return puedeGestionarExpedienteDeDependencia(permisos, expediente.dependenciaId);
}

/** ¿Puede cerrar un expediente documental (firma del índice electrónico, Art. 4.3.2.4 Acuerdo 001/2024 AGN)? */
export function puedeCerrarExpediente(permisos: PermisosUsuario): boolean {
  return puedeAdministrarArchivo(permisos);
}
