import { cache } from "react";
import { db } from "@/lib/db";
import type { NivelAccesoTramite, SeccionSoloLectura, RolCorrespondencia, RolContratacion, EtapaContratacion } from "@prisma/client";
import { getSession, type SessionPayload } from "@/lib/auth";
import { getConfiguracionSitio } from "@/lib/config-sitio";

export type PermisosUsuario = {
  esAdmin: boolean;
  tramites: Map<string, NivelAccesoTramite>;
  secciones: Set<SeccionSoloLectura>;
  correspondencia: RolCorrespondencia | null;
  dependenciaId: string | null;
  puedeFirmar: boolean;
  contratacion: RolContratacion | null;
  contratistaId: string | null;
  supervisaExpedientes: Set<string>;
  cargos: Set<string>;
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
  const esAdmin = Boolean(usuario?.activo) && usuario?.rol === "ADMIN";
  const tramites = new Map<string, NivelAccesoTramite>();
  const secciones = new Set<SeccionSoloLectura>();
  if (usuario?.activo && !esAdmin) {
    for (const t of usuario.tramitesAcceso) tramites.set(t.tramiteTipoId, t.nivel);
    for (const s of usuario.seccionesAcceso) secciones.add(s.seccion);
  }
  const rolVencido = Boolean(usuario?.rolCorrespondenciaVigenteHasta && usuario.rolCorrespondenciaVigenteHasta < new Date());
  const sgdeaOculto = !config.sgdeaVisibleFuncionarios && !esAdmin;
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
    cargos: new Set(usuario?.activo ? usuario.cargos : []),
  };
});

export const verificarSesion = cache(async (): Promise<SessionPayload | null> => {
  const session = await getSession();
  if (!session) return null;
  const usuario = await obtenerUsuarioFresco(session.userId);
  if (!usuario || !usuario.activo) return null;
  return { userId: session.userId, email: session.email, nombre: session.nombre, rol: usuario.rol, cargos: usuario.cargos };
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
  return permisos.esAdmin || permisos.correspondencia !== null;
}

export function puedeRadicar(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.correspondencia === "OPERADOR_VENTANILLA" || permisos.correspondencia === "ADMIN_ARCHIVO";
}

export function puedeDespachar(permisos: PermisosUsuario): boolean {
  return puedeRadicar(permisos);
}

export function puedeFirmar(permisos: PermisosUsuario): boolean {
  return puedeAccederCorrespondencia(permisos) && permisos.puedeFirmar;
}

export function puedeDistribuir(permisos: PermisosUsuario): boolean {
  return (
    permisos.esAdmin ||
    permisos.correspondencia === "OPERADOR_VENTANILLA" ||
    permisos.correspondencia === "ADMIN_ARCHIVO"
  );
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
  if (permisos.correspondencia !== "JEFE_DEPENDENCIA") return false;
  if (!permisos.dependenciaId || comunicacion.dependenciaDestinoId !== permisos.dependenciaId) return false;
  return distribucionesVigentes.some(
    (d) => d.usuarioId === usuarioId || (!d.usuarioId && d.dependenciaId === permisos.dependenciaId)
  );
}

export function puedeAdministrarArchivo(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.correspondencia === "ADMIN_ARCHIVO";
}

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

export function puedeGestionarExpedienteDeDependencia(permisos: PermisosUsuario, dependenciaId: string): boolean {
  if (!puedeAccederCorrespondencia(permisos)) return false;
  if (permisos.esAdmin || permisos.correspondencia === "ADMIN_ARCHIVO") return true;
  return permisos.dependenciaId === dependenciaId;
}

export function puedeVerNivelAccesoExpediente(
  permisos: PermisosUsuario,
  expediente: { nivelAcceso: string; dependenciaId: string }
): boolean {
  if (expediente.nivelAcceso === "PUBLICA") return puedeAccederCorrespondencia(permisos);
  return puedeGestionarExpedienteDeDependencia(permisos, expediente.dependenciaId);
}

export function puedeCerrarExpediente(permisos: PermisosUsuario): boolean {
  return puedeAdministrarArchivo(permisos);
}

export function puedeAccederContratacion(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.contratacion !== null;
}

export function puedeAdministrarContratacion(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.contratacion === "ADMINISTRADOR_CONTRATACION";
}

export function puedeAprobarEtapaContratacion(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || permisos.contratacion === "JEFE_CONTRATACION";
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
  if (permisos.contratacion === "FUNCIONARIO_CONTRATACION") return true;
  if (permisos.contratacion === "SUPERVISOR_INTERVENTOR") return permisos.supervisaExpedientes.has(expediente.id);
  if (permisos.contratacion === "CONTRATISTA") {
    return etapa !== "PRECONTRACTUAL" && permisos.contratistaId !== null && permisos.contratistaId === expediente.contratistaId;
  }
  return false;
}

export function puedeAdministrarSigec(permisos: PermisosUsuario): boolean {
  return permisos.esAdmin || puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos);
}

export function puedeGestionarPeriodosInforme(permisos: PermisosUsuario, expediente: { id: string; contratistaId: string | null }): boolean {
  return permisos.contratacion !== "CONTRATISTA" && puedeSubirDocumentoContrato(permisos, expediente, "CONTRACTUAL");
}

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

export function puedeEditarConTrazaDocumentoContrato(
  permisos: PermisosUsuario,
  expediente: { id: string },
  documentoEtapa: EtapaContratacion
): boolean {
  if (documentoEtapa === "PRECONTRACTUAL") return false;
  return permisos.contratacion === "SUPERVISOR_INTERVENTOR" && permisos.supervisaExpedientes.has(expediente.id);
}

export function puedeValidarDocumentoContrato(permisos: PermisosUsuario): boolean {
  return puedeEditarSinTrazaDocumentoContrato(permisos) || permisos.contratacion === "FUNCIONARIO_CONTRATACION";
}

export function puedeVerRegistroContratistas(permisos: PermisosUsuario): boolean {
  return (
    permisos.esAdmin ||
    permisos.contratacion === "ADMINISTRADOR_CONTRATACION" ||
    permisos.contratacion === "JEFE_CONTRATACION" ||
    permisos.contratacion === "FUNCIONARIO_CONTRATACION" ||
    permisos.contratacion === "SUPERVISOR_INTERVENTOR"
  );
}

export function puedeGestionarContratistas(permisos: PermisosUsuario): boolean {
  return puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos);
}

export function puedeGestionarExpedienteCompleto(permisos: PermisosUsuario): boolean {
  return puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos) || permisos.contratacion === "FUNCIONARIO_CONTRATACION";
}

export function puedeGestionarEtapasContratacion(permisos: PermisosUsuario): boolean {
  return puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos);
}

export function puedeEliminarExpedienteContractual(permisos: PermisosUsuario): boolean {
  return puedeAdministrarContratacion(permisos) || puedeAprobarEtapaContratacion(permisos);
}

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
