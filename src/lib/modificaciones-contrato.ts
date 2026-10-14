export type TipoModificacion =
  | "PRORROGA"
  | "ADICION_VALOR"
  | "PRORROGA_Y_ADICION"
  | "SUSPENSION"
  | "VIGENCIAS_FUTURAS"
  | "CESION"
  | "TERMINACION_ANTICIPADA"
  | "OTRA";

export type ClaseTerminacion = "MUTUO_ACUERDO" | "UNILATERAL";

export const CLASES_TERMINACION: { valor: ClaseTerminacion; etiqueta: string; descripcion: string }[] = [
  { valor: "MUTUO_ACUERDO", etiqueta: "De mutuo acuerdo", descripcion: "Acta de terminación por mutuo acuerdo (A-BS-FO131, procedimiento A-BS-PR48)." },
  { valor: "UNILATERAL", etiqueta: "Unilateral", descripcion: "Acto administrativo motivado, con recurso de reposición (Ley 80 de 1993, art. 17; procedimiento A-BS-PR49)." },
];

export const TIPOS_MODIFICACION: { valor: TipoModificacion; etiqueta: string; descripcion: string; codigoFormato: string }[] = [
  { valor: "PRORROGA", etiqueta: "Prórroga del plazo", descripcion: "Acta de concertación de prórroga del plazo.", codigoFormato: "A-BS-FO123" },
  { valor: "ADICION_VALOR", etiqueta: "Adición en valor", descripcion: "Acta de concertación de adición en valor.", codigoFormato: "A-BS-FO120" },
  { valor: "PRORROGA_Y_ADICION", etiqueta: "Prórroga y adición", descripcion: "Acta de concertación de adición en valor y prórroga.", codigoFormato: "A-BS-FO120" },
  { valor: "SUSPENSION", etiqueta: "Suspensión y reinicio", descripcion: "Acta de suspensión de la ejecución y reinicio.", codigoFormato: "A-BS-FO130" },
  { valor: "VIGENCIAS_FUTURAS", etiqueta: "Vigencias futuras", descripcion: "Acto de autorización de vigencias futuras.", codigoFormato: "" },
  { valor: "CESION", etiqueta: "Cesión del contrato", descripcion: "Autorización de la cesión del contrato.", codigoFormato: "A-BS-FO114" },
  { valor: "TERMINACION_ANTICIPADA", etiqueta: "Terminación anticipada", descripcion: "Acta o acto de terminación anticipada; obliga a liquidar.", codigoFormato: "A-BS-FO131" },
  { valor: "OTRA", etiqueta: "Aclaración o modificación", descripcion: "Acta de modificación o aclaración de mutuo acuerdo.", codigoFormato: "A-BS-FO122" },
];

export const ETIQUETA_TIPO_MODIFICACION: Record<TipoModificacion, string> = {
  PRORROGA: "Prórroga",
  ADICION_VALOR: "Adición en valor",
  PRORROGA_Y_ADICION: "Prórroga y adición",
  SUSPENSION: "Suspensión",
  VIGENCIAS_FUTURAS: "Vigencias futuras",
  CESION: "Cesión",
  TERMINACION_ANTICIPADA: "Terminación anticipada",
  OTRA: "Aclaración o modificación",
};

export type SoportePresupuestal = "CDP" | "RP";

export const SOPORTES_PRESUPUESTALES: { valor: SoportePresupuestal; sigla: string; nombre: string }[] = [
  { valor: "CDP", sigla: "CDP", nombre: "Certificado de disponibilidad presupuestal" },
  { valor: "RP", sigla: "RP", nombre: "Registro presupuestal" },
];

export function soportesRequeridos(m: { tipo: TipoModificacion }): SoportePresupuestal[] {
  if (m.tipo === "ADICION_VALOR" || m.tipo === "PRORROGA_Y_ADICION") return ["CDP", "RP"];
  if (m.tipo === "VIGENCIAS_FUTURAS") return ["RP"];
  return [];
}

export const MOTIVO_SIN_CDP = "Sin recursos nuevos de la vigencia en curso: el respaldo es el acto de autorización de vigencias futuras.";

export function esDocumentoModificacion(nombre: string | null | undefined): boolean {
  if (/certificado|disponibilidad presupuestal|registro presupuestal|garant[ií]a|p[oó]liza/i.test(nombre ?? "")) return false;
  return /pr[oó]rroga|adici[oó]n(?![a-záéíóúñ])|modificatori|otro\s*s[ií](?![a-záéíóúñ])|modificaci[oó]n(?![a-záéíóúñ])|suspensi[oó]n|cesi[oó]n|terminaci[oó]n anticipada/i.test(
    nombre ?? ""
  );
}

export type DatosModificacion = {
  tipo: TipoModificacion;
  fecha: string | null;
  claseTerminacion: ClaseTerminacion | null;
  observacion: string | null;
};

const fechaIso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export function leerModificacion(v: unknown): DatosModificacion | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const tipo = TIPOS_MODIFICACION.find((t) => t.valor === b.tipo)?.valor;
  if (!tipo) return null;
  const observacion = typeof b.observacion === "string" ? b.observacion.trim().slice(0, 1000) : "";
  return {
    tipo,
    fecha: fechaIso(b.fecha),
    claseTerminacion: tipo === "TERMINACION_ANTICIPADA" ? CLASES_TERMINACION.find((c) => c.valor === b.claseTerminacion)?.valor ?? null : null,
    observacion: observacion || null,
  };
}

export function errorModificacion(m: DatosModificacion, hoy: Date = new Date()): string | null {
  if (!m.fecha) return "Indique la fecha de suscripción del acta.";
  if (new Date(`${m.fecha}T00:00:00Z`).getTime() > hoy.getTime()) return "La fecha de suscripción no puede ser posterior a hoy.";
  if (m.tipo === "TERMINACION_ANTICIPADA" && !m.claseTerminacion) return "Indique si la terminación es de mutuo acuerdo o unilateral.";
  if (m.tipo === "OTRA" && !m.observacion) return "Describa brevemente la aclaración o modificación.";
  return null;
}
