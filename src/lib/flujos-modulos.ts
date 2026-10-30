import type { AmbitoFlujo, AsignacionPaso, ModuloAplicativo, TipoComunicacion, TipoPasoFlujo } from "@prisma/client";
import {
  esJefeDeReparto,
  puedeAdministrarArchivo,
  puedeAdministrarGecon,
  puedeDistribuir,
  puedeEditarFormatosVisita,
  type PermisosUsuario,
} from "@/lib/permisos";

export type ModuloFlujo = "SGDEA" | "GECON" | "TRAMITES";

export const AMBITOS_DE_MODULO: Record<ModuloFlujo, AmbitoFlujo[]> = {
  SGDEA: ["COMUNICACION", "EXPEDIENTE"],
  GECON: ["CONTRATO"],
  TRAMITES: ["TRAMITE"],
};

export function moduloDeAmbito(ambito: AmbitoFlujo): ModuloFlujo {
  if (ambito === "CONTRATO") return "GECON";
  if (ambito === "TRAMITE") return "TRAMITES";
  return "SGDEA";
}

export const MODULO_APLICATIVO: Record<ModuloFlujo, ModuloAplicativo> = { SGDEA: "SGDEA", GECON: "GECON", TRAMITES: "TRAMITES" };

export const RUTA_FLUJOS: Record<ModuloFlujo, string> = {
  SGDEA: "/correspondencia/admin/flujos",
  GECON: "/contratacion/flujos",
  TRAMITES: "/tramites-ambientales/flujos",
};

export function puedeAdministrarFlujosModulo(permisos: PermisosUsuario, modulo: ModuloFlujo): boolean {
  if (modulo === "GECON") return permisos.esAdmin || puedeAdministrarGecon(permisos);
  if (modulo === "TRAMITES") return permisos.esAdmin || puedeEditarFormatosVisita(permisos);
  return puedeAdministrarArchivo(permisos);
}

export function puedeOperarFlujosSgdea(permisos: PermisosUsuario): boolean {
  return puedeAdministrarArchivo(permisos) || puedeDistribuir(permisos) || esJefeDeReparto(permisos);
}

export const ASIGNACIONES_DE_MODULO: Record<ModuloFlujo, AsignacionPaso[]> = {
  SGDEA: ["DEPENDENCIA_COMUNICACION", "DEPENDENCIA_FIJA", "CARGO", "RADICADOR", "RESPONSABLE_PASO_ANTERIOR", "MANUAL"],
  GECON: ["PERSONAL_ASIGNADO", "SUPERVISOR", "DEPENDENCIA_COMUNICACION", "DEPENDENCIA_FIJA", "CARGO", "RADICADOR", "RESPONSABLE_PASO_ANTERIOR", "MANUAL"],
  TRAMITES: ["PERSONAL_ASIGNADO", "DEPENDENCIA_FIJA", "CARGO", "RADICADOR", "RESPONSABLE_PASO_ANTERIOR", "MANUAL"],
};

export const ASIGNACION_POR_DEFECTO: Record<ModuloFlujo, AsignacionPaso> = {
  SGDEA: "DEPENDENCIA_COMUNICACION",
  GECON: "PERSONAL_ASIGNADO",
  TRAMITES: "PERSONAL_ASIGNADO",
};

const ETIQUETA_ASIGNACION_BASE: Record<AsignacionPaso, string> = {
  DEPENDENCIA_COMUNICACION: "Dependencia de la comunicación o del expediente",
  DEPENDENCIA_FIJA: "Una dependencia fija",
  CARGO: "Un cargo",
  RADICADOR: "Quien radicó o abrió el expediente",
  RESPONSABLE_PASO_ANTERIOR: "Responsable del paso anterior",
  MANUAL: "Se asigna a mano",
  PERSONAL_ASIGNADO: "Personal asignado al expediente",
  SUPERVISOR: "Supervisor del contrato",
};

const ETIQUETA_ASIGNACION_MODULO: Record<ModuloFlujo, Partial<Record<AsignacionPaso, string>>> = {
  SGDEA: {},
  GECON: {
    DEPENDENCIA_COMUNICACION: "Dependencia solicitante del contrato",
    RADICADOR: "Quien creó el expediente contractual",
    PERSONAL_ASIGNADO: "Personal de contratación asignado",
  },
  TRAMITES: { RADICADOR: "Quien radicó el expediente" },
};

export function etiquetaAsignacion(asignacion: AsignacionPaso, modulo: ModuloFlujo): string {
  return ETIQUETA_ASIGNACION_MODULO[modulo][asignacion] ?? ETIQUETA_ASIGNACION_BASE[asignacion];
}

export const ETIQUETA_ASIGNACION = ETIQUETA_ASIGNACION_BASE;

export const TIPOS_PASO_DE_MODULO: Record<ModuloFlujo, TipoPasoFlujo[]> = {
  SGDEA: ["TAREA", "REVISION", "DECISION", "FIRMA", "FIN"],
  GECON: ["TAREA", "REVISION", "DECISION", "FIN"],
  TRAMITES: ["TAREA", "REVISION", "DECISION", "FIN"],
};

export const OPCIONES_APLICA_A: Record<ModuloFlujo, Record<string, string>> = {
  SGDEA: {
    "": "Cualquier tipo de comunicación",
    RECIBIDA: "Solo recibidas",
    ENVIADA: "Solo enviadas",
    INTERNA: "Solo memorandos",
    EXPEDIENTE: "Expedientes documentales",
  },
  GECON: { CONTRATO: "Expedientes contractuales" },
  TRAMITES: { TRAMITE: "Expedientes de trámites ambientales" },
};

export function aplicaAFormulario(valor: string, modulo: ModuloFlujo = "SGDEA"): { aplicaA: TipoComunicacion | null; ambito: AmbitoFlujo } {
  if (modulo === "GECON") return { aplicaA: null, ambito: "CONTRATO" };
  if (modulo === "TRAMITES") return { aplicaA: null, ambito: "TRAMITE" };
  if (valor === "EXPEDIENTE") return { aplicaA: null, ambito: "EXPEDIENTE" };
  const tipos: TipoComunicacion[] = ["RECIBIDA", "ENVIADA", "INTERNA"];
  return { aplicaA: tipos.includes(valor as TipoComunicacion) ? (valor as TipoComunicacion) : null, ambito: "COMUNICACION" };
}

export function valorAplicaA(flujo: { ambito: AmbitoFlujo; aplicaA: TipoComunicacion | null }): string {
  if (flujo.ambito === "COMUNICACION") return flujo.aplicaA ?? "";
  return flujo.ambito;
}

export function etiquetaAplicaA(flujo: { ambito: AmbitoFlujo; aplicaA: TipoComunicacion | null }): string {
  return OPCIONES_APLICA_A[moduloDeAmbito(flujo.ambito)][valorAplicaA(flujo)] ?? "";
}
