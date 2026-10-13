export type TipoModificacion = "PRORROGA" | "ADICION_VALOR" | "PRORROGA_Y_ADICION" | "SUSPENSION" | "OTRA";

export const TIPOS_MODIFICACION: { valor: TipoModificacion; etiqueta: string; descripcion: string; codigoFormato: string }[] = [
  { valor: "PRORROGA", etiqueta: "Prórroga del plazo", descripcion: "Amplía la fecha de terminación.", codigoFormato: "A-BS-FO123" },
  { valor: "ADICION_VALOR", etiqueta: "Adición en valor", descripcion: "Aumenta el valor del contrato.", codigoFormato: "A-BS-FO120" },
  { valor: "PRORROGA_Y_ADICION", etiqueta: "Prórroga y adición", descripcion: "Amplía el plazo y aumenta el valor.", codigoFormato: "A-BS-FO120" },
  { valor: "SUSPENSION", etiqueta: "Suspensión y reinicio", descripcion: "Detiene la ejecución; la terminación se corre los días suspendidos.", codigoFormato: "A-BS-FO130" },
  { valor: "OTRA", etiqueta: "Aclaración o modificación", descripcion: "Cambia otras condiciones, sin plazo ni valor.", codigoFormato: "A-BS-FO122" },
];

export const ETIQUETA_TIPO_MODIFICACION: Record<TipoModificacion, string> = {
  PRORROGA: "Prórroga",
  ADICION_VALOR: "Adición en valor",
  PRORROGA_Y_ADICION: "Prórroga y adición",
  SUSPENSION: "Suspensión",
  OTRA: "Aclaración o modificación",
};

export const LIMITE_ADICION = 0.5;

const MS_DIA = 24 * 60 * 60 * 1000;

export function esDocumentoModificacion(nombre: string | null | undefined): boolean {
  if (/certificado|disponibilidad presupuestal|registro presupuestal|garant[ií]a|p[oó]liza/i.test(nombre ?? "")) return false;
  return /pr[oó]rroga|adici[oó]n(?![a-záéíóúñ])|modificatori|otro\s*s[ií](?![a-záéíóúñ])|modificaci[oó]n(?![a-záéíóúñ])|suspensi[oó]n/i.test(nombre ?? "");
}

export function cambiaPlazo(tipo: TipoModificacion): boolean {
  return tipo === "PRORROGA" || tipo === "PRORROGA_Y_ADICION";
}

export function cambiaValor(tipo: TipoModificacion): boolean {
  return tipo === "ADICION_VALOR" || tipo === "PRORROGA_Y_ADICION";
}

export type DatosModificacion = {
  tipo: TipoModificacion;
  fechaTerminacion: string | null;
  valorAdicionado: number | null;
  fechaSuspension: string | null;
  fechaReinicio: string | null;
  vigenciasFuturas: boolean;
  observacion: string | null;
};

const fechaIso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function leerModificacion(v: unknown): DatosModificacion | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const tipo = TIPOS_MODIFICACION.find((t) => t.valor === b.tipo)?.valor;
  if (!tipo) return null;
  const valor = Number(b.valorAdicionado);
  const observacion = typeof b.observacion === "string" ? b.observacion.trim().slice(0, 1000) : "";
  return {
    tipo,
    fechaTerminacion: cambiaPlazo(tipo) ? fechaIso(b.fechaTerminacion) : null,
    valorAdicionado: cambiaValor(tipo) && Number.isFinite(valor) && valor > 0 ? Math.round(valor) : null,
    fechaSuspension: tipo === "SUSPENSION" ? fechaIso(b.fechaSuspension) : null,
    fechaReinicio: tipo === "SUSPENSION" ? fechaIso(b.fechaReinicio) : null,
    vigenciasFuturas: b.vigenciasFuturas === true,
    observacion: observacion || null,
  };
}

export function diasSuspendidos(m: Pick<DatosModificacion, "fechaSuspension" | "fechaReinicio">): number {
  if (!m.fechaSuspension || !m.fechaReinicio) return 0;
  return Math.max(0, Math.round((utc(m.fechaReinicio).getTime() - utc(m.fechaSuspension).getTime()) / MS_DIA));
}

export function nuevaFechaTerminacion(m: DatosModificacion, actual: Date | null): Date | null {
  if (cambiaPlazo(m.tipo) && m.fechaTerminacion) return utc(m.fechaTerminacion);
  if (m.tipo === "SUSPENSION" && actual) {
    const dias = diasSuspendidos(m);
    return dias > 0 ? new Date(actual.getTime() + dias * MS_DIA) : null;
  }
  return null;
}

export function vigenciasComprometidas(actual: Date | null, nueva: Date | null): number[] {
  if (!actual || !nueva) return [];
  const anios: number[] = [];
  for (let a = actual.getUTCFullYear() + 1; a <= nueva.getUTCFullYear(); a++) anios.push(a);
  return anios;
}

export function textoAnios(anios: number[]): string {
  return anios.length <= 1 ? String(anios[0] ?? "") : `${anios.slice(0, -1).join(", ")} y ${anios.at(-1)}`;
}

export function pasaDeVigencia(actual: Date | null, nueva: Date | null): boolean {
  return vigenciasComprometidas(actual, nueva).length > 0;
}

export function errorModificacion(
  m: DatosModificacion,
  contrato: { terminacion: Date | null; valorInicial: number | null; adicionadoPrevio: number }
): string | null {
  if (cambiaPlazo(m.tipo)) {
    if (!m.fechaTerminacion) return "Indique la nueva fecha de terminación.";
    if (contrato.terminacion && utc(m.fechaTerminacion) <= contrato.terminacion) return "La nueva fecha de terminación debe ser posterior a la actual.";
  }
  if (cambiaValor(m.tipo)) {
    if (!m.valorAdicionado) return "Indique el valor adicionado.";
    if (contrato.valorInicial && contrato.adicionadoPrevio + m.valorAdicionado > contrato.valorInicial * LIMITE_ADICION) {
      return "Las adiciones no pueden superar el 50 % del valor inicial del contrato.";
    }
  }
  if (m.tipo === "SUSPENSION") {
    if (!m.fechaSuspension || !m.fechaReinicio) return "Indique la fecha de suspensión y la de reinicio.";
    if (diasSuspendidos(m) <= 0) return "La fecha de reinicio debe ser posterior a la de suspensión.";
  }
  if (m.tipo === "OTRA" && !m.observacion) return "Describa brevemente la aclaración o modificación.";
  if (pasaDeVigencia(contrato.terminacion, nuevaFechaTerminacion(m, contrato.terminacion)) && !m.vigenciasFuturas) {
    const anios = vigenciasComprometidas(contrato.terminacion, nuevaFechaTerminacion(m, contrato.terminacion));
    return `La nueva terminación compromete la vigencia ${textoAnios(anios)}: confirme la autorización de vigencias futuras para ${anios.length > 1 ? "cada año" : "ese año"}.`;
  }
  return null;
}
