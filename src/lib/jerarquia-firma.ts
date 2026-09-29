import { denominacionParaFirma, esClaveDenominacion, type DenominacionEmpleoClave } from "@/lib/denominacion-empleo";

export type ModuloFirma = "SGDEA" | "TRAMITES" | "GECON";

export type PersonaFirmante = {
  denominacionEmpleo: string | null;
  denominacionComplemento?: string | null;
  sexo?: string | null;
  rolContratacion?: string | null;
};

export const NIVELES_FIRMA = {
  DIRECCION: 1,
  SECRETARIA_GENERAL: 2,
  JEFATURA: 3,
  FUNCIONARIO: 4,
  CONTRATISTA: 5,
} as const;

export type NivelFirma = (typeof NIVELES_FIRMA)[keyof typeof NIVELES_FIRMA];

export const ETIQUETA_NIVEL_FIRMA: Record<NivelFirma, string> = {
  1: "Dirección General",
  2: "Secretaría General",
  3: "Subdirección / Jefatura de Oficina",
  4: "Funcionario / Supervisor",
  5: "Contratista",
};

const NIVEL_POR_DENOMINACION: Partial<Record<DenominacionEmpleoClave, NivelFirma>> = {
  DIRECTOR_GENERAL: 1,
  SECRETARIO_GENERAL: 2,
  SUBDIRECTOR: 3,
  JEFE_OFICINA: 3,
  CONTRATISTA: 5,
  JUDICANTE: 5,
  PRACTICANTE: 5,
};

export function esContratista(p: PersonaFirmante): boolean {
  return p.denominacionEmpleo === "CONTRATISTA" || p.rolContratacion === "CONTRATISTA";
}

export function nivelFirma(p: PersonaFirmante): NivelFirma {
  if (esContratista(p)) return 5;
  if (esClaveDenominacion(p.denominacionEmpleo)) return NIVEL_POR_DENOMINACION[p.denominacionEmpleo] ?? 4;
  return 4;
}

export function puedeSerFirmantePrincipal(p: PersonaFirmante, modulo: ModuloFirma): boolean {
  if (modulo === "GECON") return true;
  return nivelFirma(p) < 5;
}

export function puedeSolicitarFirmas(p: PersonaFirmante): boolean {
  return !esContratista(p);
}

export function cargoDelFirmante(p: PersonaFirmante, modulo?: ModuloFirma): string {
  const denominacion = denominacionParaFirma(p.denominacionEmpleo, p.sexo, p.denominacionComplemento);
  if (modulo === "GECON" && p.rolContratacion === "SUPERVISOR_INTERVENTOR") {
    return denominacion ? `${denominacion} · Supervisor` : "Supervisor";
  }
  if (denominacion) return denominacion;
  if (esContratista(p)) return "Contratista";
  return "Funcionario";
}
