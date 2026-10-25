import type { RolContratacion, RolCorrespondencia, SeccionSoloLectura } from "@prisma/client";
import {
  puedeAccederContratacion,
  puedeAccederCorrespondencia,
  puedeAccederFirmasTramite,
  puedeAccederSeccion,
  puedeAccederSolicitantes,
  puedeAdministrarArchivo,
  puedeAdministrarCatalogoContratacion,
  puedeAdministrarContratacion,
  puedeAprobarEtapaContratacion,
  puedeAsignarFirmantesDocumentoContrato,
  puedeAsignarPersonalContrato,
  puedeCrearExpedienteContractual,
  puedeDespachar,
  puedeDistribuir,
  puedeEditarConTrazaDocumentoContrato,
  puedeEditarDatosContrato,
  puedeEditarSinTrazaDocumentoContrato,
  puedeEliminarExpedienteContractual,
  puedeFirmar,
  puedeGestionarContratistas,
  puedeGestionarExpedienteDeDependencia,
  puedeGestionarPeriodosInforme,
  puedeRadicar,
  puedeRegistrarContratistaMinimo,
  puedeResponderComoAsignado,
  puedeSubdistribuirInternamente,
  puedeSubirDocumentoContrato,
  puedeValidarDocumentoContrato,
  puedeVerDocumentoContrato,
  puedeVerExpedienteContractual,
  puedeVerRegistroContratistas,
  puedeVerTableroContratos,
  type PermisosUsuario,
} from "@/lib/permisos";
import type { Accion, Matriz, ModuloPerfil } from "@/lib/perfiles-catalogo";

const USUARIO = "usuario-referencia";
const DEPENDENCIA = "dependencia-referencia";
const EXPEDIENTE = "expediente-referencia";
const CONTRATISTA = "contratista-referencia";

export type RolLegado =
  | { tipo: "ADMIN" }
  | { tipo: "CORRESPONDENCIA"; rol: RolCorrespondencia }
  | { tipo: "CONTRATACION"; rol: RolContratacion }
  | { tipo: "TRAMITES"; nivel: "VER" | "EDITAR" }
  | { tipo: "SECCION"; seccion: SeccionSoloLectura };

export function permisosDeReferencia(rol: RolLegado): PermisosUsuario {
  const contratacion = rol.tipo === "CONTRATACION" ? new Set([rol.rol]) : new Set<RolContratacion>();
  return {
    esAdmin: rol.tipo === "ADMIN",
    tramites: rol.tipo === "TRAMITES" ? new Map([["tramite-referencia", rol.nivel]]) : new Map(),
    secciones: rol.tipo === "SECCION" ? new Set([rol.seccion]) : new Set(),
    correspondencia: rol.tipo === "CORRESPONDENCIA" ? rol.rol : null,
    dependenciaId: DEPENDENCIA,
    puedeFirmar: true,
    rolesContratacion: contratacion,
    contratistaId: contratacion.has("CONTRATISTA") ? CONTRATISTA : null,
    supervisaExpedientes: contratacion.has("SUPERVISOR_INTERVENTOR") ? new Set([EXPEDIENTE]) : new Set(),
    asignadoExpedientes: contratacion.has("FUNCIONARIO_CONTRATACION") ? new Set([EXPEDIENTE]) : new Set(),
    cargos: new Set(),
    cargosEncargo: new Set(),
    modulos: new Set(["TRAMITES", "SGDEA", "GECON", "VITAL", "SINCA"]),
    porPerfil: new Set(),
    matriz: new Map(),
  };
}

export function matrizDesdeReglas(p: PermisosUsuario): Matriz {
  const expediente = {
    id: EXPEDIENTE,
    contratistaId: CONTRATISTA,
    dependenciaSolicitanteId: DEPENDENCIA,
    etapaActual: "CONTRACTUAL" as const,
    eliminado: false,
    cerrado: false,
  };
  const reparto = [{ usuarioId: USUARIO, dependenciaId: DEPENDENCIA }];
  const editarTramites = p.esAdmin || [...p.tramites.values()].some((n) => n === "EDITAR");

  const reglas: Record<string, Partial<Record<Accion, boolean>>> = {
    "admin.usuarios": { LEER: p.esAdmin, CREAR: p.esAdmin, ACTUALIZAR: p.esAdmin },
    "admin.perfiles": { LEER: p.esAdmin, ACTUALIZAR: p.esAdmin },
    "admin.auditoria": { LEER: p.esAdmin },
    "admin.seguridad": { ACTUALIZAR: p.esAdmin },
    "admin.apariencia": { ACTUALIZAR: p.esAdmin },
    "admin.modulos": { ACTUALIZAR: p.esAdmin },
    "admin.trd": { ACTUALIZAR: p.esAdmin },

    "tramites.expedientes": { LEER: p.esAdmin || p.tramites.size > 0, ACTUALIZAR: editarTramites },
    "tramites.solicitantes": { LEER: puedeAccederSolicitantes(p) },
    "tramites.firmas": { LEER: puedeAccederFirmasTramite(p) },
    "tramites.firmantes": { ACTUALIZAR: p.esAdmin },
    "tramites.planeador": { ACTUALIZAR: p.esAdmin },
    "tramites.formatos-visita": { ACTUALIZAR: p.esAdmin },

    "sgdea.bandeja": { LEER: puedeAccederCorrespondencia(p) },
    "sgdea.radicacion": { CREAR: puedeRadicar(p), ACTUALIZAR: puedeDespachar(p) },
    "sgdea.reparto": { ACTUALIZAR: puedeDistribuir(p) },
    "sgdea.reparto-interno": {
      ACTUALIZAR: p.esAdmin || puedeSubdistribuirInternamente(p, USUARIO, { dependenciaDestinoId: DEPENDENCIA }, reparto),
    },
    "sgdea.respuesta": { CREAR: puedeResponderComoAsignado(p, USUARIO, reparto) },
    "sgdea.firma": { ACTUALIZAR: puedeFirmar(p) },
    "sgdea.memorandos": { LEER: puedeAccederCorrespondencia(p), CREAR: puedeAccederCorrespondencia(p) && puedeRadicar(p) },
    "sgdea.expedientes": {
      LEER: puedeAccederCorrespondencia(p),
      CREAR: puedeGestionarExpedienteDeDependencia(p, DEPENDENCIA),
      ACTUALIZAR: puedeGestionarExpedienteDeDependencia(p, DEPENDENCIA),
    },
    "sgdea.archivo": { ACTUALIZAR: puedeAdministrarArchivo(p) },
    "sgdea.configuracion": { ACTUALIZAR: puedeAdministrarArchivo(p) },

    "gecon.acceso": { LEER: puedeAccederContratacion(p) },
    "gecon.todos": { LEER: puedeAdministrarContratacion(p) || puedeAprobarEtapaContratacion(p) },
    "gecon.dependencia": { LEER: p.esAdmin || p.rolesContratacion.has("JEFE_DEPENDENCIA") },
    "gecon.disposicion": { ACTUALIZAR: puedeAdministrarContratacion(p) },
    "gecon.expedientes": {
      LEER: puedeAccederContratacion(p) && puedeVerExpedienteContractual(p, expediente),
      CREAR: puedeCrearExpedienteContractual(p),
      ACTUALIZAR: puedeEditarDatosContrato(p, expediente),
      ELIMINAR: puedeEliminarExpedienteContractual(p),
    },
    "gecon.precontractual": {
      LEER: puedeAccederContratacion(p) && puedeVerDocumentoContrato(p, { ...expediente, etapaActual: "PRECONTRACTUAL" }, "PRECONTRACTUAL"),
    },
    "gecon.etapas": { ACTUALIZAR: puedeAprobarEtapaContratacion(p) },
    "gecon.documentos": {
      CREAR: puedeSubirDocumentoContrato(p, expediente, "CONTRACTUAL"),
      ACTUALIZAR: puedeEditarSinTrazaDocumentoContrato(p) || puedeEditarConTrazaDocumentoContrato(p, expediente, "CONTRACTUAL"),
    },
    "gecon.validacion": { ACTUALIZAR: puedeValidarDocumentoContrato(p, expediente, "PRECONTRACTUAL") },
    "gecon.firmantes": { ACTUALIZAR: puedeAsignarFirmantesDocumentoContrato(p, expediente) },
    "gecon.informes": { ACTUALIZAR: puedeGestionarPeriodosInforme(p, expediente) },
    "gecon.contratistas": {
      LEER: puedeVerRegistroContratistas(p),
      CREAR: puedeRegistrarContratistaMinimo(p),
      ACTUALIZAR: puedeGestionarContratistas(p),
    },
    "gecon.personal": { ACTUALIZAR: puedeAsignarPersonalContrato(p) },
    "gecon.tablero": { LEER: puedeVerTableroContratos(p) },
    "gecon.catalogo": { ACTUALIZAR: puedeAdministrarCatalogoContratacion(p) },
    "gecon.administracion": { ACTUALIZAR: puedeAdministrarContratacion(p) || puedeAprobarEtapaContratacion(p) },

    "vital.solicitudes": { LEER: puedeAccederSeccion(p, "VITAL_BASE") },
    "vital.tablero": { LEER: puedeAccederSeccion(p, "VITAL_DASHBOARD") },
    "sinca.solicitudes": { LEER: puedeAccederSeccion(p, "SINCA_BASE") },
    "sinca.tablero": { LEER: puedeAccederSeccion(p, "SINCA_DASHBOARD") },
    "sinca.mineria": { LEER: puedeAccederSeccion(p, "SINCA_MINERIA") },
  };

  const matriz: Matriz = {};
  for (const [clave, acciones] of Object.entries(reglas)) {
    const concedidas = (Object.keys(acciones) as Accion[]).filter((a) => acciones[a]);
    if (concedidas.length > 0) matriz[clave] = concedidas;
  }
  return matriz;
}

export type PerfilSemilla = { claveOrigen: string; nombre: string; modulo: ModuloPerfil; descripcion: string; rol: RolLegado };

export const PERFILES_SEMILLA: readonly PerfilSemilla[] = [
  { claveOrigen: "ADMIN", nombre: "Administrador del sistema", modulo: "GENERAL", descripcion: "Acceso completo a todos los módulos y a la administración.", rol: { tipo: "ADMIN" } },

  { claveOrigen: "TRAMITES:VER", nombre: "Trámites — consulta", modulo: "TRAMITES", descripcion: "Consulta los expedientes de los tipos de trámite habilitados.", rol: { tipo: "TRAMITES", nivel: "VER" } },
  { claveOrigen: "TRAMITES:EDITAR", nombre: "Trámites — gestión", modulo: "TRAMITES", descripcion: "Gestiona los expedientes de los tipos de trámite habilitados.", rol: { tipo: "TRAMITES", nivel: "EDITAR" } },

  { claveOrigen: "SGDEA:OPERADOR_VENTANILLA", nombre: "SGDEA — Operador de ventanilla", modulo: "SGDEA", descripcion: "Radica, reparte y despacha la correspondencia.", rol: { tipo: "CORRESPONDENCIA", rol: "OPERADOR_VENTANILLA" } },
  { claveOrigen: "SGDEA:FUNCIONARIO_DEPENDENCIA", nombre: "SGDEA — Funcionario de dependencia", modulo: "SGDEA", descripcion: "Atiende y proyecta respuesta a lo que se le asigna.", rol: { tipo: "CORRESPONDENCIA", rol: "FUNCIONARIO_DEPENDENCIA" } },
  { claveOrigen: "SGDEA:JEFE_DEPENDENCIA", nombre: "SGDEA — Jefe de dependencia", modulo: "SGDEA", descripcion: "Redistribuye en su oficina y gestiona sus expedientes.", rol: { tipo: "CORRESPONDENCIA", rol: "JEFE_DEPENDENCIA" } },
  { claveOrigen: "SGDEA:ADMIN_ARCHIVO", nombre: "SGDEA — Administrador de archivo", modulo: "SGDEA", descripcion: "Administra TRD, archivo, transferencias y disposición final.", rol: { tipo: "CORRESPONDENCIA", rol: "ADMIN_ARCHIVO" } },

  { claveOrigen: "GECON:ADMINISTRADOR_CONTRATACION", nombre: "GECON — Administrador de contratación", modulo: "GECON", descripcion: "Gestión completa del módulo de contratación.", rol: { tipo: "CONTRATACION", rol: "ADMINISTRADOR_CONTRATACION" } },
  { claveOrigen: "GECON:JEFE_CONTRATACION", nombre: "GECON — Jefe de contratación", modulo: "GECON", descripcion: "Aprueba etapas y gestiona todos los expedientes.", rol: { tipo: "CONTRATACION", rol: "JEFE_CONTRATACION" } },
  { claveOrigen: "GECON:FUNCIONARIO_CONTRATACION", nombre: "GECON — Personal de contratación", modulo: "GECON", descripcion: "Gestiona los expedientes que tiene asignados.", rol: { tipo: "CONTRATACION", rol: "FUNCIONARIO_CONTRATACION" } },
  { claveOrigen: "GECON:JEFE_DEPENDENCIA", nombre: "GECON — Jefe de dependencia", modulo: "GECON", descripcion: "Consulta y valida los contratos de su dependencia.", rol: { tipo: "CONTRATACION", rol: "JEFE_DEPENDENCIA" } },
  { claveOrigen: "GECON:SUPERVISOR_INTERVENTOR", nombre: "GECON — Supervisor o interventor", modulo: "GECON", descripcion: "Gestiona la ejecución de los contratos que supervisa.", rol: { tipo: "CONTRATACION", rol: "SUPERVISOR_INTERVENTOR" } },
  { claveOrigen: "GECON:CONTRATISTA", nombre: "GECON — Contratista", modulo: "GECON", descripcion: "Consulta su contrato y carga sus informes, sin la etapa precontractual.", rol: { tipo: "CONTRATACION", rol: "CONTRATISTA" } },

  { claveOrigen: "SECCION:VITAL_BASE", nombre: "VITAL — solicitudes", modulo: "VITAL", descripcion: "Consulta las solicitudes de VITAL.", rol: { tipo: "SECCION", seccion: "VITAL_BASE" } },
  { claveOrigen: "SECCION:VITAL_DASHBOARD", nombre: "VITAL — tablero", modulo: "VITAL", descripcion: "Consulta el tablero de VITAL.", rol: { tipo: "SECCION", seccion: "VITAL_DASHBOARD" } },
  { claveOrigen: "SECCION:SINCA_BASE", nombre: "SINCA 1.0 — solicitudes", modulo: "SINCA", descripcion: "Consulta solicitudes y NIT del histórico.", rol: { tipo: "SECCION", seccion: "SINCA_BASE" } },
  { claveOrigen: "SECCION:SINCA_DASHBOARD", nombre: "SINCA 1.0 — tablero", modulo: "SINCA", descripcion: "Consulta el tablero del histórico.", rol: { tipo: "SECCION", seccion: "SINCA_DASHBOARD" } },
  { claveOrigen: "SECCION:SINCA_MINERIA", nombre: "SINCA 1.0 — minería de datos", modulo: "SINCA", descripcion: "Consulta la minería de datos del histórico.", rol: { tipo: "SECCION", seccion: "SINCA_MINERIA" } },
];

export function matrizSemilla(semilla: PerfilSemilla): Matriz {
  return matrizDesdeReglas(permisosDeReferencia(semilla.rol));
}
