import { cache } from "react";
import { db } from "@/lib/db";
import type { NivelAccesoTramite, SeccionSoloLectura, RolCorrespondencia, RolContratacion, EtapaContratacion } from "@prisma/client";
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
  /** Rol dentro del módulo de Contratación. null = sin acceso (salvo ADMIN). */
  contratacion: RolContratacion | null;
  /** Id de Contratista vinculado a este usuario, si lo tiene (login por Directorio Activo). */
  contratistaId: string | null;
  /** Ids de ExpedienteContractual donde este usuario es supervisor/interventor. */
  supervisaExpedientes: Set<string>;
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
  rolContratacion: RolContratacion | null;
  rolContratacionVigenteHasta: Date | null;
  contratistaId: string | null;
  supervisaExpedientes: string[];
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
      rolContratacion: true,
      rolContratacionVigenteHasta: true,
      contratista: { select: { id: true } },
      supervisionesContrato: { select: { expedienteId: true } },
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
    rolContratacion: usuario.rolContratacion,
    rolContratacionVigenteHasta: usuario.rolContratacionVigenteHasta,
    contratistaId: usuario.contratista?.id ?? null,
    supervisaExpedientes: usuario.supervisionesContrato.map((s) => s.expedienteId),
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
  // Mismo criterio MoReq 6.3 que rolCorrespondenciaVigenteHasta: pensado para que
  // el acceso de un Contratista/Supervisor venza solo al terminar su contrato.
  const rolContratacionVencido = Boolean(
    usuario?.rolContratacionVigenteHasta && usuario.rolContratacionVigenteHasta < new Date()
  );
  return {
    esAdmin,
    tramites,
    secciones,
    correspondencia: usuario?.activo && !rolVencido && !sgdeaOculto ? usuario.rolCorrespondencia : null,
    dependenciaId: usuario?.activo ? usuario.dependenciaId : null,
    puedeFirmar: esAdmin || Boolean(usuario?.activo && usuario.accesoFirma),
    contratacion: usuario?.activo && !rolContratacionVencido ? usuario.rolContratacion : null,
    contratistaId: usuario?.activo ? usuario.contratistaId : null,
    supervisaExpedientes: new Set(usuario?.activo ? usuario.supervisaExpedientes : []),
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

/**
 * ¿Puede este JEFE_DEPENDENCIA redistribuir INTERNAMENTE, dentro de SU PROPIA dependencia, una
 * comunicación que ya llegó asignada a él o a su dependencia (por reparto de ventanilla si es
 * RECIBIDA, o directo si es un memorando INTERNA con destinatario)? Distinto de `puedeDistribuir`
 * (ventanilla/archivo, reparto centralizado): esto es la sub-distribución del jefe a sus propios
 * colaboradores una vez la comunicación ya está en su oficina — nunca puede redirigirla a otra
 * dependencia. Pedido explícito del usuario: "casi siempre debe ser el jefe de esa oficina para
 * que luego él lo distribuya a sus colaboradores".
 */
export function puedeSubdistribuirInternamente(
  permisos: PermisosUsuario,
  usuarioId: string,
  comunicacion: { dependenciaDestinoId: string | null },
  distribucionesVigentes: { usuarioId: string | null; dependenciaId: string | null }[]
): boolean {
  if (permisos.correspondencia !== "JEFE_DEPENDENCIA") return false;
  if (!permisos.dependenciaId || comunicacion.dependenciaDestinoId !== permisos.dependenciaId) return false;
  return distribucionesVigentes.some(
    (d) => d.usuarioId === usuarioId || (!d.usuarioId && d.dependenciaId === permisos.dependenciaId)
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

// --- Módulo de Contratación ----------------------------------------------
// Manejador de expedientes digitales de contratación (Manual A-BS-MA01),
// deliberadamente aislado del SGDEA de correspondencia. Denegado por
// defecto, igual que los demás módulos: sin `rolContratacion` (y sin ser
// ADMIN) no se entra.

/** ¿Puede entrar al módulo de Contratación? */
export function puedeAccederContratacion(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.contratacion !== null;
}

/**
 * Administrador de Contratación: el encargado de sistemas, con permisos totales sobre el módulo.
 * Decisión explícita del usuario (2026-09-18): Jefe de Contratación tiene el MISMO nivel
 * operativo (ver `puedeAprobarEtapaContratacion`) — los dos valores del enum se mantienen
 * separados solo por motivo organizacional (quién ostenta cada cargo real), no porque tengan
 * capacidades distintas dentro de la app.
 */
export function puedeAdministrarContratacion(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.contratacion === "ADMINISTRADOR_CONTRATACION";
}

/** Jefe de Contratación: mismo nivel operativo que Administrador (ver arriba, fusionados desde
 * 2026-09-18) — aprueba el paso de etapa, gestiona expedientes/contratistas de TODA la entidad, y
 * puede eliminar un expediente completo. */
export function puedeAprobarEtapaContratacion(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.contratacion === "JEFE_CONTRATACION";
}

/**
 * Excepción explícita y deliberada, pedida por el usuario tras advertir el
 * riesgo de auditoría (ver plan `virtual-knitting-kettle.md`): SOLO
 * Administrador de Contratación y Jefe de Contratación pueden editar/eliminar
 * un `DocumentoContrato` sin que quede ninguna fila en `EventoContratacion` —
 * ni Supervisor/Interventor ni Contratista tienen este permiso. Motivo: ~1000
 * contratistas rotando, errores de captura frecuentes, exigir siempre una
 * traza sería inviable operativamente. Exclusivo de este módulo — NUNCA
 * replicar este patrón en DocumentoArchivo (SGDEA) ni en ningún otro dominio.
 */
export function puedeEditarSinTrazaDocumentoContrato(permisos: PermisosUsuario): boolean {
  return puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos);
}

/**
 * ¿Puede subir un documento a este expediente, en esta etapa? Reglas del
 * Manual (confirmadas por el usuario): Administrador/Jefe siempre; Supervisor
 * solo si está asignado a ese expediente; Contratista solo en su propio
 * expediente y NUNCA en Precontractual (ahí el documento lo produce la
 * Oficina de Contratación o el Supervisor, el contratista aún no interviene).
 */
export function puedeSubirDocumentoContrato(
  permisos: PermisosUsuario,
  expediente: { id: string; contratistaId: string | null },
  etapa: EtapaContratacion
): boolean {
  if (puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos)) return true;
  if (permisos.contratacion === "FUNCIONARIO_CONTRATACION") return true;
  if (permisos.contratacion === "SUPERVISOR_INTERVENTOR") return permisos.supervisaExpedientes.has(expediente.id);
  if (permisos.contratacion === "CONTRATISTA") {
    return etapa !== "PRECONTRACTUAL" && permisos.contratistaId !== null && permisos.contratistaId === expediente.contratistaId;
  }
  return false;
}

/**
 * ¿Puede asignar quién debe firmar/dar visto bueno/tener solo lectura sobre un documento de este
 * expediente? Administrador/Jefe de Contratación: cualquiera. Funcionario de Contratación:
 * cualquiera (es justamente su función transversal — "parametrizar" quién firma cada documento,
 * sin poder firmar ni gestionar él mismo). Jefe de dependencia/Subdirector: solo los de SU propia
 * dependencia solicitante. Supervisor/Interventor: solo los que supervisa (incluido poder enviar
 * un documento a firma del propio contratista). El Contratista NUNCA asigna firmantes — solo
 * firma lo que le asignen (decisión explícita del usuario, 2026-09-18).
 */
export function puedeAsignarFirmantesDocumentoContrato(
  permisos: PermisosUsuario,
  expediente: { id: string; dependenciaSolicitanteId: string }
): boolean {
  if (puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos)) return true;
  if (permisos.contratacion === "FUNCIONARIO_CONTRATACION") return true;
  if (permisos.contratacion === "JEFE_DEPENDENCIA") return permisos.dependenciaId === expediente.dependenciaSolicitanteId;
  if (permisos.contratacion === "SUPERVISOR_INTERVENTOR") return permisos.supervisaExpedientes.has(expediente.id);
  return false;
}

/**
 * ¿Puede este Supervisor/Interventor editar o eliminar un documento de un expediente que
 * supervisa — CON traza en `EventoContratacion` (a diferencia de la excepción SIN traza de
 * Administrador/Jefe, ver `puedeEditarSinTrazaDocumentoContrato`)? Pedido explícito del usuario
 * (2026-09-18): "gestionar o eliminar archivos de esos contratos bajo su supervisión, en caso algo
 * le quedara mal" — deliberadamente CON registro: a diferencia de la excepción de
 * Administrador/Jefe (motivada por ~1000 contratistas rotando), aquí no hay el mismo volumen que
 * justifique renunciar a la trazabilidad.
 */
export function puedeEditarConTrazaDocumentoContrato(permisos: PermisosUsuario, expediente: { id: string }): boolean {
  return permisos.contratacion === "SUPERVISOR_INTERVENTOR" && permisos.supervisaExpedientes.has(expediente.id);
}

/** ¿Puede ver el registro maestro de Contratistas (buscar/listar/detalle)? Cualquier rol de
 * gestión o revisión transversal del módulo — deliberadamente EXCLUYE a Jefe de
 * dependencia/Subdirector (acotado a su propia dependencia) y al rol Contratista, que no debe
 * poder navegar el registro de contacto de otros contratistas. */
export function puedeVerRegistroContratistas(permisos: PermisosUsuario): boolean {
  return (
    permisos.esAdmin ||
    permisos.contratacion === "ADMINISTRADOR_CONTRATACION" ||
    permisos.contratacion === "JEFE_CONTRATACION" ||
    permisos.contratacion === "FUNCIONARIO_CONTRATACION" ||
    permisos.contratacion === "SUPERVISOR_INTERVENTOR"
  );
}

/** ¿Puede crear/editar el registro maestro de un Contratista? Mismo nivel que la edición sin
 * traza de documentos: Administrador y Jefe de Contratación. */
export function puedeGestionarContratistas(permisos: PermisosUsuario): boolean {
  return puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos);
}

/** ¿Puede aprobar el paso de etapa O retroceder una etapa ya aprobada (corrección de un error)?
 * Mismo nivel que la edición sin traza de documentos: Administrador y Jefe de Contratación. */
export function puedeGestionarEtapasContratacion(permisos: PermisosUsuario): boolean {
  return puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos);
}

/** ¿Puede eliminar un expediente contractual COMPLETO (incluso cerrado)? Administrador o Jefe de
 * Contratación (fusionados en capacidades desde 2026-09-18) — más severo que editar/eliminar un
 * solo documento, ya no exclusivo del Administrador. */
export function puedeEliminarExpedienteContractual(permisos: PermisosUsuario): boolean {
  return puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos);
}

/**
 * ¿Puede VER este expediente contractual?
 * - Administrador/Jefe de Contratación: todos, de cualquier dependencia.
 * - Funcionario de Contratación: todos — rol de revisión/apoyo transversal sin poder de gestión
 *   (sube documentos con traza normal, asigna firmantes, pero no aprueba etapas ni elimina nada).
 * - Jefe de dependencia/Subdirector: solo los de SU PROPIA dependencia solicitante.
 * - Supervisor/Interventor: solo los que supervisa.
 * - Contratista: solo el(los) suyo(s).
 */
export function puedeVerExpedienteContractual(
  permisos: PermisosUsuario,
  expediente: { id: string; contratistaId: string | null; dependenciaSolicitanteId: string }
): boolean {
  if (puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos)) return true;
  if (permisos.contratacion === "FUNCIONARIO_CONTRATACION") return true;
  if (permisos.contratacion === "JEFE_DEPENDENCIA") return permisos.dependenciaId === expediente.dependenciaSolicitanteId;
  if (permisos.contratacion === "SUPERVISOR_INTERVENTOR") return permisos.supervisaExpedientes.has(expediente.id);
  if (permisos.contratacion === "CONTRATISTA") return permisos.contratistaId !== null && permisos.contratistaId === expediente.contratistaId;
  return false;
}

/** ¿Alguna vez se le asignó a este usuario firmar/dar visto bueno/leer algún documento de este
 * expediente? Es una concesión de visibilidad ADICIONAL (nunca la única forma de entrar al
 * módulo: sigue exigiendo tener algún `rolContratacion`) para el caso real que motivó pedir
 * "usuarios de solo lectura": alguien con acceso al módulo pero sin rol normal sobre ESTE
 * expediente en particular (ej. un funcionario de otra dependencia agregado como lector). */
export async function tieneSolicitudFirmaEnExpedienteContractual(usuarioId: string, expedienteId: string): Promise<boolean> {
  const n = await db.solicitudFirma.count({ where: { usuarioAsignadoId: usuarioId, documentoContrato: { expedienteId } } });
  return n > 0;
}

/**
 * ¿Puede asignar quién debe firmar/dar visto bueno/tener solo lectura sobre esta comunicación?
 * En SGDEA es el jefe de LA DEPENDENCIA de la comunicación (JEFE_DEPENDENCIA con la misma
 * dependencia que el destino/origen), o un rol superior (ADMIN_ARCHIVO/ADMIN).
 */
export function puedeAsignarFirmantesComunicacion(
  permisos: PermisosUsuario,
  comunicacion: { dependenciaDestinoId: string | null; dependenciaOrigenId: string | null }
): boolean {
  if (!puedeAccederCorrespondencia(permisos)) return false;
  if (permisos.esAdmin || permisos.correspondencia === "ADMIN_ARCHIVO") return true;
  if (permisos.correspondencia !== "JEFE_DEPENDENCIA") return false;
  const dependenciaComunicacion = comunicacion.dependenciaDestinoId ?? comunicacion.dependenciaOrigenId;
  return dependenciaComunicacion !== null && dependenciaComunicacion === permisos.dependenciaId;
}
