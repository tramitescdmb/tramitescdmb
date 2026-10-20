import { cache } from "react";
import { db } from "@/lib/db";
import type { NivelAccesoTramite, SeccionSoloLectura, RolCorrespondencia, RolContratacion, EtapaContratacion, ModuloAplicativo, Prisma } from "@prisma/client";
import { getSession, type SessionPayload } from "@/lib/auth";
import { getConfiguracionSitio } from "@/lib/config-sitio";

export type PermisosUsuario = {
  esAdmin: boolean;
  tramites: Map<string, NivelAccesoTramite>;
  secciones: Set<SeccionSoloLectura>;
  correspondencia: RolCorrespondencia | null;
  dependenciaId: string | null;
  puedeFirmar: boolean;
  rolesContratacion: Set<RolContratacion>;
  contratistaId: string | null;
  supervisaExpedientes: Set<string>;
  asignadoExpedientes: Set<string>;
  cargos: Set<string>;
  /** Nombres de los cargos (de entre `cargos`) que este usuario ejerce en encargo — se muestran con "(E)". */
  cargosEncargo: Set<string>;
  modulos: Set<ModuloAplicativo>;
  porPerfil: Set<string>;
  matriz: Map<string, Set<string>>;
};

type UsuarioFresco = {
  activo: boolean;
  rol: "ADMIN" | "FUNCIONARIO";
  cargos: string[];
  cargosEncargo: string[];
  tramitesAcceso: { tramiteTipoId: string; nivel: NivelAccesoTramite }[];
  seccionesAcceso: { seccion: SeccionSoloLectura }[];
  rolCorrespondencia: RolCorrespondencia | null;
  rolCorrespondenciaVigenteHasta: Date | null;
  dependenciaId: string | null;
  accesoFirma: boolean;
  rolesContratacion: RolContratacion[];
  rolContratacionVigenteHasta: Date | null;
  modulosAcceso: ModuloAplicativo[];
  contratistaId: string | null;
  supervisaExpedientes: string[];
  asignadoExpedientes: string[];
  terminosAceptadosEn: Date | null;
  permisosPerfil: { funcionalidad: string; acciones: string[] }[];
  excepciones: { funcionalidad: string; tipo: "CONCEDER" | "QUITAR"; acciones: string[] }[];
} | null;

const obtenerUsuarioFresco = cache(async (userId: string): Promise<UsuarioFresco> => {
  const usuario = await db.usuario.findUnique({
    where: { id: userId },
    select: {
      activo: true,
      rol: true,
      cargoAsignaciones: { select: { encargo: true, cargo: { select: { nombre: true } } } },
      tramitesAcceso: { select: { tramiteTipoId: true, nivel: true } },
      seccionesAcceso: { select: { seccion: true } },
      rolCorrespondencia: true,
      rolCorrespondenciaVigenteHasta: true,
      dependenciaId: true,
      accesoFirma: true,
      rolesContratacion: true,
      rolContratacionVigenteHasta: true,
      modulosAcceso: true,
      contratista: { select: { id: true } },
      supervisionesContrato: { select: { expedienteId: true } },
      asignacionesContrato: { select: { expedienteId: true } },
      terminosAceptadosEn: true,
      perfiles: { select: { perfil: { select: { activo: true, permisos: { select: { funcionalidad: true, acciones: true } } } } } },
      excepcionesPermiso: { select: { funcionalidad: true, tipo: true, acciones: true } },
    },
  });
  if (!usuario) return null;
  return {
    activo: usuario.activo,
    rol: usuario.rol,
    cargos: usuario.cargoAsignaciones.map((uc) => uc.cargo.nombre),
    cargosEncargo: usuario.cargoAsignaciones.filter((uc) => uc.encargo).map((uc) => uc.cargo.nombre),
    tramitesAcceso: usuario.tramitesAcceso,
    seccionesAcceso: usuario.seccionesAcceso,
    rolCorrespondencia: usuario.rolCorrespondencia,
    rolCorrespondenciaVigenteHasta: usuario.rolCorrespondenciaVigenteHasta,
    dependenciaId: usuario.dependenciaId,
    accesoFirma: usuario.accesoFirma,
    rolesContratacion: usuario.rolesContratacion,
    rolContratacionVigenteHasta: usuario.rolContratacionVigenteHasta,
    modulosAcceso: usuario.modulosAcceso,
    contratistaId: usuario.contratista?.id ?? null,
    supervisaExpedientes: usuario.supervisionesContrato.map((s) => s.expedienteId),
    asignadoExpedientes: usuario.asignacionesContrato.map((a) => a.expedienteId),
    terminosAceptadosEn: usuario.terminosAceptadosEn,
    permisosPerfil: usuario.perfiles.filter((up) => up.perfil.activo).flatMap((up) => up.perfil.permisos),
    excepciones: usuario.excepcionesPermiso,
  };
});

export function construirMatriz(
  permisosPerfil: { funcionalidad: string; acciones: string[] }[],
  excepciones: { funcionalidad: string; tipo: "CONCEDER" | "QUITAR"; acciones: string[] }[]
): Map<string, Set<string>> {
  const matriz = new Map<string, Set<string>>();
  const agregar = (f: string, a: string) => {
    if (!matriz.has(f)) matriz.set(f, new Set());
    matriz.get(f)!.add(a);
  };
  for (const p of permisosPerfil) for (const a of p.acciones) agregar(p.funcionalidad, a);
  for (const e of excepciones) if (e.tipo === "CONCEDER") for (const a of e.acciones) agregar(e.funcionalidad, a);
  for (const e of excepciones) if (e.tipo === "QUITAR") for (const a of e.acciones) matriz.get(e.funcionalidad)?.delete(a);
  return matriz;
}

export function rigePorPerfil(permisos: PermisosUsuario, modulo: string): boolean {
  return permisos.porPerfil.has(modulo);
}

export function tienePermiso(permisos: PermisosUsuario, funcionalidad: string, accion: string): boolean {
  return permisos.matriz.get(funcionalidad)?.has(accion) ?? false;
}

function sgdeaPorPerfil(permisos: PermisosUsuario): boolean {
  return !permisos.esAdmin && rigePorPerfil(permisos, "SGDEA");
}

function sgdeaPermite(permisos: PermisosUsuario, funcionalidad: string, accion: string): boolean {
  return permisos.modulos.has("SGDEA") && tienePermiso(permisos, funcionalidad, accion);
}

export async function terminosAceptados(userId: string): Promise<boolean> {
  return Boolean((await obtenerUsuarioFresco(userId))?.terminosAceptadosEn);
}

export const obtenerModulosPorPerfil = cache(async (): Promise<string[]> => {
  const fila = await db.configuracionSitio.findUnique({ where: { id: "singleton" }, select: { modulosPorPerfil: true } });
  return fila?.modulosPorPerfil ?? [];
});

export const obtenerPermisosUsuario = cache(async (userId: string): Promise<PermisosUsuario> => {
  const [usuario, config, modulosPorPerfil] = await Promise.all([obtenerUsuarioFresco(userId), getConfiguracionSitio(), obtenerModulosPorPerfil()]);
  const esAdmin = Boolean(usuario?.activo) && usuario?.rol === "ADMIN";
  const tramites = new Map<string, NivelAccesoTramite>();
  const secciones = new Set<SeccionSoloLectura>();
  const habilitados = new Set(usuario?.modulosAcceso ?? []);
  const visiblesGlobal: Record<ModuloAplicativo, boolean> = {
    TRAMITES: config.tramitesVisibleFuncionarios,
    SGDEA: config.sgdeaVisibleFuncionarios,
    GECON: config.geconVisibleFuncionarios,
    VITAL: config.vitalVisibleFuncionarios,
    SINCA: config.sincaVisibleFuncionarios,
  };
  const modulos = new Set<ModuloAplicativo>(
    (Object.keys(visiblesGlobal) as ModuloAplicativo[]).filter((m) => esAdmin || (Boolean(usuario?.activo) && habilitados.has(m) && visiblesGlobal[m]))
  );
  if (usuario?.activo && !esAdmin) {
    if (modulos.has("TRAMITES")) {
      for (const t of usuario.tramitesAcceso) tramites.set(t.tramiteTipoId, t.nivel);
    }
    for (const s of usuario.seccionesAcceso) {
      if (modulos.has(s.seccion.startsWith("VITAL_") ? "VITAL" : "SINCA")) secciones.add(s.seccion);
    }
  }
  const rolVencido = Boolean(usuario?.rolCorrespondenciaVigenteHasta && usuario.rolCorrespondenciaVigenteHasta < new Date());
  const sgdeaOculto = !modulos.has("SGDEA");
  const geconOculto = !modulos.has("GECON");
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
    rolesContratacion: new Set(usuario?.activo && !rolContratacionVencido && !geconOculto ? usuario.rolesContratacion : []),
    contratistaId: usuario?.activo && !geconOculto ? usuario.contratistaId : null,
    supervisaExpedientes: new Set(usuario?.activo && !geconOculto ? usuario.supervisaExpedientes : []),
    asignadoExpedientes: new Set(usuario?.activo && !geconOculto ? usuario.asignadoExpedientes : []),
    cargos: new Set(usuario?.activo ? usuario.cargos : []),
    cargosEncargo: new Set(usuario?.activo ? usuario.cargosEncargo : []),
    modulos,
    porPerfil: new Set(modulosPorPerfil),
    matriz: usuario?.activo && !rolVencido ? construirMatriz(usuario.permisosPerfil, usuario.excepciones) : new Map(),
  };
});

export const verificarSesion = cache(async (): Promise<SessionPayload | null> => {
  const session = await getSession();
  if (!session) return null;
  const usuario = await obtenerUsuarioFresco(session.userId);
  if (!usuario || !usuario.activo) return null;
  return {
    userId: session.userId,
    email: session.email,
    nombre: session.nombre,
    rol: usuario.rol,
    cargos: usuario.cargos,
    cargosEncargo: usuario.cargosEncargo,
  };
});

export function puedeAccederTramite(permisos: PermisosUsuario, tramiteTipoId: string): boolean {
  return permisos.esAdmin || permisos.tramites.has(tramiteTipoId);
}

export function puedeEditarTramite(permisos: PermisosUsuario, tramiteTipoId: string): boolean {
  return permisos.esAdmin || permisos.tramites.get(tramiteTipoId) === "EDITAR";
}

export function puedeAccederSeccion(permisos: PermisosUsuario, seccion: SeccionSoloLectura): boolean {
  return permisos.esAdmin || permisos.secciones.has(seccion);
}

export function puedeAccederSolicitantes(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.tramites.size > 0;
}

export async function puedeEditarExpediente(userId: string, expedienteId: string): Promise<boolean> {
  const permisos = await obtenerPermisosUsuario(userId);
  if (permisos.esAdmin) return true;
  const expediente = await db.expediente.findUnique({ where: { id: expedienteId }, select: { tramiteTipoId: true } });
  if (!expediente) return true;
  return puedeEditarTramite(permisos, expediente.tramiteTipoId);
}

export function puedeAccederCorrespondencia(permisos: PermisosUsuario): boolean {
  if (sgdeaPorPerfil(permisos)) return sgdeaPermite(permisos, "sgdea.bandeja", "LEER");
  return permisos.esAdmin || permisos.correspondencia !== null;
}

export function puedeRadicar(permisos: PermisosUsuario): boolean {
  if (sgdeaPorPerfil(permisos)) return sgdeaPermite(permisos, "sgdea.radicacion", "CREAR");
  return permisos.esAdmin || permisos.correspondencia === "OPERADOR_VENTANILLA" || permisos.correspondencia === "ADMIN_ARCHIVO";
}

export function puedeDespachar(permisos: PermisosUsuario): boolean {
  if (sgdeaPorPerfil(permisos)) return sgdeaPermite(permisos, "sgdea.radicacion", "ACTUALIZAR");
  return puedeRadicar(permisos);
}

export function puedeFirmar(permisos: PermisosUsuario): boolean {
  if (sgdeaPorPerfil(permisos)) return permisos.puedeFirmar && sgdeaPermite(permisos, "sgdea.firma", "ACTUALIZAR");
  return puedeAccederCorrespondencia(permisos) && permisos.puedeFirmar;
}

export function puedeDistribuir(permisos: PermisosUsuario): boolean {
  if (sgdeaPorPerfil(permisos)) return sgdeaPermite(permisos, "sgdea.reparto", "ACTUALIZAR");
  return (
    permisos.esAdmin ||
    permisos.correspondencia === "OPERADOR_VENTANILLA" ||
    permisos.correspondencia === "ADMIN_ARCHIVO"
  );
}

export function esJefeDeReparto(permisos: PermisosUsuario): boolean {
  if (sgdeaPorPerfil(permisos)) return sgdeaPermite(permisos, "sgdea.reparto-interno", "ACTUALIZAR");
  return permisos.correspondencia === "JEFE_DEPENDENCIA";
}

export function puedeGestionarArchivo(permisos: PermisosUsuario): boolean {
  if (sgdeaPorPerfil(permisos)) return sgdeaPermite(permisos, "sgdea.archivo", "ACTUALIZAR");
  return puedeAdministrarArchivo(permisos);
}

export function puedeEnviarMemorandoPorPerfil(permisos: PermisosUsuario): boolean {
  if (sgdeaPorPerfil(permisos)) return sgdeaPermite(permisos, "sgdea.memorandos", "CREAR");
  return puedeRadicar(permisos);
}

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

export function puedeSubdistribuirInternamente(
  permisos: PermisosUsuario,
  usuarioId: string,
  comunicacion: { dependenciaDestinoId: string | null },
  distribucionesVigentes: { usuarioId: string | null; dependenciaId: string | null }[]
): boolean {
  if (!esJefeDeReparto(permisos)) return false;
  if (!permisos.dependenciaId || comunicacion.dependenciaDestinoId !== permisos.dependenciaId) return false;
  return distribucionesVigentes.some(
    (d) => d.usuarioId === usuarioId || (!d.usuarioId && d.dependenciaId === permisos.dependenciaId)
  );
}

export function puedeAdministrarArchivo(permisos: PermisosUsuario): boolean {
  if (sgdeaPorPerfil(permisos)) return sgdeaPermite(permisos, "sgdea.configuracion", "ACTUALIZAR");
  return permisos.esAdmin || permisos.correspondencia === "ADMIN_ARCHIVO";
}

export function puedeResponderComoAsignado(
  permisos: PermisosUsuario,
  usuarioId: string,
  distribucionesVigentes: { usuarioId: string | null; dependenciaId: string | null }[]
): boolean {
  if (!puedeAccederCorrespondencia(permisos)) return false;
  if (permisos.esAdmin) return true;
  if (sgdeaPorPerfil(permisos) && !sgdeaPermite(permisos, "sgdea.respuesta", "CREAR")) return false;
  return distribucionesVigentes.some((d) =>
    d.usuarioId
      ? d.usuarioId === usuarioId
      : Boolean(d.dependenciaId) && d.dependenciaId === permisos.dependenciaId
  );
}

export function puedeGestionarExpedienteDeDependencia(permisos: PermisosUsuario, dependenciaId: string): boolean {
  if (!puedeAccederCorrespondencia(permisos)) return false;
  if (sgdeaPorPerfil(permisos) && !sgdeaPermite(permisos, "sgdea.expedientes", "ACTUALIZAR")) return false;
  if (permisos.esAdmin || puedeGestionarArchivo(permisos)) return true;
  return permisos.dependenciaId === dependenciaId;
}

export function puedeVerNivelAccesoExpediente(
  permisos: PermisosUsuario,
  expediente: { nivelAcceso: string; dependenciaId: string }
): boolean {
  if (expediente.nivelAcceso === "PUBLICA") return puedeAccederCorrespondencia(permisos);
  if (sgdeaPorPerfil(permisos)) {
    if (!puedeAccederCorrespondencia(permisos) || !sgdeaPermite(permisos, "sgdea.expedientes", "LEER")) return false;
    return puedeGestionarArchivo(permisos) || permisos.dependenciaId === expediente.dependenciaId;
  }
  return puedeGestionarExpedienteDeDependencia(permisos, expediente.dependenciaId);
}

export function puedeCerrarExpediente(permisos: PermisosUsuario): boolean {
  return puedeGestionarArchivo(permisos);
}

export function tieneRolContratacion(permisos: PermisosUsuario, rol: RolContratacion): boolean {
  return permisos.rolesContratacion.has(rol);
}

export function esContratistaGecon(permisos: PermisosUsuario): boolean {
  return !permisos.esAdmin && permisos.rolesContratacion.has("CONTRATISTA");
}

export function puedeAccederContratacion(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.rolesContratacion.size > 0;
}

export function puedeAdministrarContratacion(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || tieneRolContratacion(permisos, "ADMINISTRADOR_CONTRATACION");
}

export function puedeAprobarEtapaContratacion(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || tieneRolContratacion(permisos, "JEFE_CONTRATACION") || tieneRolContratacion(permisos, "ADMINISTRADOR_CONTRATACION");
}

export function puedeAdministrarCatalogoContratacion(permisos: PermisosUsuario): boolean {
  return puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos);
}

export function puedeCrearExpedienteContractual(permisos: PermisosUsuario): boolean {
  return puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos) || tieneRolContratacion(permisos, "FUNCIONARIO_CONTRATACION");
}

export function puedeVerTableroContratos(permisos: PermisosUsuario): boolean {
  return (
    puedeAdministrarContratacion(permisos) ||
    puedeAprobarEtapaContratacion(permisos) ||
    (["FUNCIONARIO_CONTRATACION", "JEFE_DEPENDENCIA", "SUPERVISOR_INTERVENTOR"] as const).some((r) => tieneRolContratacion(permisos, r))
  );
}

function gestionaComoPersonal(permisos: PermisosUsuario, expedienteId: string): boolean {
  return tieneRolContratacion(permisos, "FUNCIONARIO_CONTRATACION") && permisos.asignadoExpedientes.has(expedienteId);
}

function gestionaComoSupervisor(permisos: PermisosUsuario, expedienteId: string): boolean {
  return tieneRolContratacion(permisos, "SUPERVISOR_INTERVENTOR") && permisos.supervisaExpedientes.has(expedienteId);
}

function esJefeDeLaDependencia(permisos: PermisosUsuario, dependenciaId: string): boolean {
  return tieneRolContratacion(permisos, "JEFE_DEPENDENCIA") && permisos.dependenciaId === dependenciaId;
}

function esContratistaDelExpediente(permisos: PermisosUsuario, expediente: { contratistaId: string | null }): boolean {
  return tieneRolContratacion(permisos, "CONTRATISTA") && permisos.contratistaId !== null && permisos.contratistaId === expediente.contratistaId;
}

export function puedeEditarSinTrazaDocumentoContrato(permisos: PermisosUsuario): boolean {
  return puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos);
}

export function puedeSubirDocumentoContrato(
  permisos: PermisosUsuario,
  expediente: { id: string; contratistaId: string | null },
  etapa: EtapaContratacion
): boolean {
  if (puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos)) return true;
  if (gestionaComoPersonal(permisos, expediente.id) || gestionaComoSupervisor(permisos, expediente.id)) return true;
  return etapa !== "PRECONTRACTUAL" && esContratistaDelExpediente(permisos, expediente);
}

export function puedeAdministrarGecon(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos);
}

export function puedeGestionarPeriodosInforme(permisos: PermisosUsuario, expediente: { id: string; contratistaId: string | null }): boolean {
  return !esContratistaGecon(permisos) && puedeSubirDocumentoContrato(permisos, expediente, "CONTRACTUAL");
}

export function puedeRegistrarModificacionContrato(
  permisos: PermisosUsuario,
  expediente: { id: string; contratistaId: string | null; cerrado: boolean }
): boolean {
  return !expediente.cerrado && puedeGestionarPeriodosInforme(permisos, expediente);
}

export function puedeAsignarFirmantesDocumentoContrato(
  permisos: PermisosUsuario,
  expediente: { id: string; dependenciaSolicitanteId: string }
): boolean {
  if (puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos)) return true;
  return (
    gestionaComoPersonal(permisos, expediente.id) ||
    esJefeDeLaDependencia(permisos, expediente.dependenciaSolicitanteId) ||
    gestionaComoSupervisor(permisos, expediente.id)
  );
}

export function puedeEditarConTrazaDocumentoContrato(
  permisos: PermisosUsuario,
  expediente: { id: string },
  documentoEtapa: EtapaContratacion
): boolean {
  if (gestionaComoPersonal(permisos, expediente.id)) return true;
  if (documentoEtapa === "PRECONTRACTUAL") return false;
  return gestionaComoSupervisor(permisos, expediente.id);
}

export function puedeValidarDocumentoContrato(
  permisos: PermisosUsuario,
  expediente: { id: string; dependenciaSolicitanteId: string },
  documentoEtapa: EtapaContratacion
): boolean {
  if (documentoEtapa !== "PRECONTRACTUAL") return false;
  if (puedeEditarSinTrazaDocumentoContrato(permisos)) return true;
  return gestionaComoPersonal(permisos, expediente.id) || esJefeDeLaDependencia(permisos, expediente.dependenciaSolicitanteId);
}

export function puedeVerRegistroContratistas(permisos: PermisosUsuario): boolean {
  return (
    permisos.esAdmin ||
    (["ADMINISTRADOR_CONTRATACION", "JEFE_CONTRATACION", "FUNCIONARIO_CONTRATACION", "SUPERVISOR_INTERVENTOR"] as const).some((r) =>
      tieneRolContratacion(permisos, r)
    )
  );
}

export function puedeGestionarContratistas(permisos: PermisosUsuario): boolean {
  return puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos);
}

/** Registrar/editar el perfil mínimo (sin Usuario) de un contratista: también el Personal de
 * Contratación en general, no solo cuando está asignado a un expediente puntual — a diferencia de
 * vincular un expediente ya existente a un contratista, que sigue siendo cosa de quien gestiona. */
export function puedeRegistrarContratistaMinimo(permisos: PermisosUsuario): boolean {
  return puedeGestionarContratistas(permisos) || tieneRolContratacion(permisos, "FUNCIONARIO_CONTRATACION");
}

export function puedeAsignarPersonalContrato(permisos: PermisosUsuario): boolean {
  return puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos);
}

export function puedeSubirEnCualquierEtapaContrato(permisos: PermisosUsuario): boolean {
  return puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos) || tieneRolContratacion(permisos, "FUNCIONARIO_CONTRATACION");
}

export function puedeGestionarExpedienteCompleto(permisos: PermisosUsuario, expediente: { id: string }): boolean {
  if (puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos)) return true;
  return gestionaComoPersonal(permisos, expediente.id) || gestionaComoSupervisor(permisos, expediente.id);
}

export function puedeEditarDatosContrato(permisos: PermisosUsuario, expediente: { id: string }): boolean {
  if (puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos)) return true;
  return gestionaComoPersonal(permisos, expediente.id);
}

export function puedeGestionarEtapasContratacion(permisos: PermisosUsuario): boolean {
  return puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos);
}

export function puedeEliminarExpedienteContractual(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || puedeAprobarEtapaContratacion(permisos);
}

export function puedeVerExpedienteContractual(
  permisos: PermisosUsuario,
  expediente: { id: string; contratistaId: string | null; dependenciaSolicitanteId: string; etapaActual: EtapaContratacion; eliminado: boolean }
): boolean {
  if (expediente.eliminado) return false;
  if (puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos)) return true;
  if (
    gestionaComoPersonal(permisos, expediente.id) ||
    esJefeDeLaDependencia(permisos, expediente.dependenciaSolicitanteId) ||
    gestionaComoSupervisor(permisos, expediente.id)
  ) {
    return true;
  }
  return expediente.etapaActual !== "PRECONTRACTUAL" && esContratistaDelExpediente(permisos, expediente);
}

export function puedeVerDocumentoContrato(
  permisos: PermisosUsuario,
  expediente: { id: string; contratistaId: string | null; dependenciaSolicitanteId: string; etapaActual: EtapaContratacion; eliminado: boolean },
  documentoEtapa: EtapaContratacion
): boolean {
  if (esContratistaGecon(permisos) && documentoEtapa === "PRECONTRACTUAL") return false;
  return puedeVerExpedienteContractual(permisos, expediente);
}

export async function tieneSolicitudFirmaEnExpedienteContractual(usuarioId: string, expedienteId: string): Promise<boolean> {
  const n = await db.solicitudFirma.count({ where: { usuarioAsignadoId: usuarioId, documentoContrato: { expedienteId } } });
  return n > 0;
}

export async function tieneFirmaOSolicitudEnDocumentoContrato(usuarioId: string, documentoId: string): Promise<boolean> {
  const [firmas, solicitudes] = await Promise.all([
    db.firmaDocumentoContrato.count({ where: { usuarioId, documentoId } }),
    db.solicitudFirma.count({ where: { usuarioAsignadoId: usuarioId, documentoContratoId: documentoId } }),
  ]);
  return firmas + solicitudes > 0;
}

function esVentanilla(permisos: PermisosUsuario): boolean {
  if (sgdeaPorPerfil(permisos)) return puedeRadicar(permisos) && !puedeAdministrarArchivo(permisos);
  return permisos.correspondencia === "OPERADOR_VENTANILLA";
}

function actuaComoRadicador(permisos: PermisosUsuario, comunicacion: { radicadoPorId: string | null }, usuarioId: string): boolean {
  if (permisos.esAdmin) return false;
  return esVentanilla(permisos) || comunicacion.radicadoPorId === usuarioId;
}

export function puedeAsignarFirmantesComunicacion(
  permisos: PermisosUsuario,
  comunicacion: { radicadoPorId: string | null },
  usuarioId: string,
): boolean {
  if (!puedeAccederCorrespondencia(permisos)) return false;
  if (permisos.esAdmin) return true;
  if (esContratistaGecon(permisos)) return false;
  return !actuaComoRadicador(permisos, comunicacion, usuarioId);
}

export function puedeFirmarComunicacionDirecto(
  permisos: PermisosUsuario,
  comunicacion: { radicadoPorId: string | null },
  usuarioId: string,
): boolean {
  return puedeFirmar(permisos) && !actuaComoRadicador(permisos, comunicacion, usuarioId);
}

const CARGO_SIN_ESPECIFICO = "Otro / sin cargo específico";

function tieneCargoEspecifico(permisos: PermisosUsuario): boolean {
  return [...permisos.cargos].some((c) => c !== CARGO_SIN_ESPECIFICO);
}

export function puedeAccederFirmasTramite(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.tramites.size > 0;
}

export function puedeAsignarFirmantesDocumentoTramite(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || tieneCargoEspecifico(permisos);
}

export function puedeValidarDocumentoTramite(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || tieneCargoEspecifico(permisos);
}

export const CARGOS_PLANEADOR = [
  "Coordinador(a) de Evaluación para la Sostenibilidad",
  "Subdirector(a) de Evaluación y Control Ambiental (SEYCA)",
];

export function puedePlanearVisitas(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || CARGOS_PLANEADOR.some((c) => permisos.cargos.has(c));
}

export function filtroContratistasVisibles(permisos: PermisosUsuario): Prisma.ContratistaWhereInput {
  if (puedeGestionarContratistas(permisos)) return {};
  const propios = [...permisos.asignadoExpedientes, ...permisos.supervisaExpedientes];
  return {
    OR: [
      { expedientes: { some: { id: { in: propios }, eliminado: false } } },
      ...(tieneRolContratacion(permisos, "FUNCIONARIO_CONTRATACION") ? [{ expedientes: { none: { eliminado: false } } }] : []),
    ],
  };
}

export function puedeVerContratista(permisos: PermisosUsuario, contratista: { expedientes: { id: string }[] }): boolean {
  if (puedeGestionarContratistas(permisos)) return true;
  if (contratista.expedientes.some((e) => permisos.asignadoExpedientes.has(e.id) || permisos.supervisaExpedientes.has(e.id))) return true;
  return tieneRolContratacion(permisos, "FUNCIONARIO_CONTRATACION") && contratista.expedientes.length === 0;
}

export function puedeEditarContratistaMinimo(permisos: PermisosUsuario, contratista: { expedientes: { id: string }[] }): boolean {
  if (puedeGestionarContratistas(permisos)) return true;
  if (!tieneRolContratacion(permisos, "FUNCIONARIO_CONTRATACION")) return false;
  return contratista.expedientes.length === 0 || contratista.expedientes.some((e) => permisos.asignadoExpedientes.has(e.id));
}

export function puedeEditarManualDemostracion(permisos: PermisosUsuario, modulo: "SGDEA" | "GECON"): boolean {
  return modulo === "GECON" ? puedeGestionarContratistas(permisos) : puedeAdministrarArchivo(permisos);
}
