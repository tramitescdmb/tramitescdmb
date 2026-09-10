/**
 * Denominación del empleo (nomenclatura de empleos públicos — Decreto 1083 de 2015)
 * para el sello de firma electrónica. Es el cargo NOMINAL del funcionario, distinto
 * del modelo `Cargo`, que es una clave funcional para el bloqueo de pasos de trámite.
 *
 * Se guarda la CLAVE en `Usuario.denominacionEmpleo` (texto, sin enum de BD, como el
 * resto de campos catalogados del proyecto). La forma que se muestra depende del sexo
 * registrado: la mayoría de las denominaciones tienen forma femenina.
 */
export const DENOMINACIONES_EMPLEO = {
  DIRECTOR_GENERAL: { m: "Director General", f: "Directora General" },
  SUBDIRECTOR: { m: "Subdirector", f: "Subdirectora" },
  SECRETARIO: { m: "Secretario", f: "Secretaria" },
  JEFE_OFICINA: { m: "Jefe de Oficina", f: "Jefa de Oficina" },
  ASESOR_DIRECCION: { m: "Asesor de Dirección", f: "Asesora de Dirección" },
  REVISOR_FISCAL: { m: "Revisor Fiscal", f: "Revisora Fiscal" },
  COORDINADOR_GRUPO: { m: "Coordinador de Grupo", f: "Coordinadora de Grupo" },
  PROFESIONAL_ESPECIALIZADO: { m: "Profesional Especializado", f: "Profesional Especializada" },
  PROFESIONAL_UNIVERSITARIO: { m: "Profesional Universitario", f: "Profesional Universitaria" },
  TECNICO_ADMINISTRATIVO: { m: "Técnico Administrativo", f: "Técnica Administrativa" },
  AUXILIAR_ADMINISTRATIVO: { m: "Auxiliar Administrativo", f: "Auxiliar Administrativa" },
  OPERARIO_CALIFICADO: { m: "Operario Calificado", f: "Operaria Calificada" },
  CELADOR: { m: "Celador", f: "Celadora" },
  CONDUCTOR: { m: "Conductor", f: "Conductora" },
  CONTRATISTA: { m: "Contratista", f: "Contratista" },
  JUDICANTE: { m: "Judicante", f: "Judicante" },
  PRACTICANTE: { m: "Practicante", f: "Practicante" },
} as const;

export type DenominacionEmpleoClave = keyof typeof DENOMINACIONES_EMPLEO;

export const CLAVES_DENOMINACION_EMPLEO = Object.keys(DENOMINACIONES_EMPLEO) as DenominacionEmpleoClave[];

export const SEXOS = [
  { valor: "F", etiqueta: "Femenino" },
  { valor: "M", etiqueta: "Masculino" },
] as const;

export function esClaveDenominacion(v: unknown): v is DenominacionEmpleoClave {
  return typeof v === "string" && v in DENOMINACIONES_EMPLEO;
}

export function esSexo(v: unknown): v is "M" | "F" {
  return v === "M" || v === "F";
}

/**
 * Cómo aparece la denominación en el sello de firma. Sin sexo registrado se usa la
 * forma masculina (genérico). `complemento` (ej. "en Tecnologías de Información") se
 * añade tal cual, sin flexionar.
 */
export function denominacionParaFirma(
  clave: string | null | undefined,
  sexo: string | null | undefined,
  complemento?: string | null,
): string | null {
  if (!esClaveDenominacion(clave)) return null;
  const par = DENOMINACIONES_EMPLEO[clave];
  const base = sexo === "F" ? par.f : par.m;
  const extra = complemento?.trim();
  return extra ? `${base} ${extra}` : base;
}

/** Etiqueta para listas de administración: muestra ambas formas cuando difieren. */
export function etiquetaDenominacion(clave: DenominacionEmpleoClave): string {
  const { m, f } = DENOMINACIONES_EMPLEO[clave];
  return m === f ? m : `${m} / ${f}`;
}
