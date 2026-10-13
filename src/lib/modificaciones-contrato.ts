export type TipoModificacion = "PRORROGA" | "ADICION_VALOR" | "PRORROGA_Y_ADICION" | "OTRA";

export const TIPOS_MODIFICACION: { valor: TipoModificacion; etiqueta: string }[] = [
  { valor: "PRORROGA", etiqueta: "Prórroga del plazo" },
  { valor: "ADICION_VALOR", etiqueta: "Adición en valor" },
  { valor: "PRORROGA_Y_ADICION", etiqueta: "Prórroga y adición en valor" },
  { valor: "OTRA", etiqueta: "Otra modificación (sin cambio de plazo ni valor)" },
];

export const ETIQUETA_TIPO_MODIFICACION: Record<TipoModificacion, string> = {
  PRORROGA: "Prórroga",
  ADICION_VALOR: "Adición en valor",
  PRORROGA_Y_ADICION: "Prórroga y adición",
  OTRA: "Modificación",
};

export function esDocumentoModificacion(nombre: string | null | undefined): boolean {
  if (/certificado|disponibilidad presupuestal|registro presupuestal|garant[ií]a|p[oó]liza/i.test(nombre ?? "")) return false;
  return /pr[oó]rroga|adici[oó]n(?![a-záéíóúñ])|modificatori|otro\s*s[ií](?![a-záéíóúñ])|modificaci[oó]n(?![a-záéíóúñ])/i.test(nombre ?? "");
}

export function cambiaPlazo(tipo: TipoModificacion): boolean {
  return tipo === "PRORROGA" || tipo === "PRORROGA_Y_ADICION";
}

export function cambiaValor(tipo: TipoModificacion): boolean {
  return tipo === "ADICION_VALOR" || tipo === "PRORROGA_Y_ADICION";
}

export type DatosModificacion = { tipo: TipoModificacion; fechaTerminacion: string | null; valorAdicionado: number | null };

export function leerModificacion(v: unknown): DatosModificacion | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const tipo = TIPOS_MODIFICACION.find((t) => t.valor === b.tipo)?.valor;
  if (!tipo) return null;
  const fecha = typeof b.fechaTerminacion === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.fechaTerminacion) ? b.fechaTerminacion : null;
  const valor = Number(b.valorAdicionado);
  return {
    tipo,
    fechaTerminacion: cambiaPlazo(tipo) ? fecha : null,
    valorAdicionado: cambiaValor(tipo) && Number.isFinite(valor) && valor > 0 ? Math.round(valor) : null,
  };
}

export function errorModificacion(m: DatosModificacion, fechaTerminacionActual: Date | null): string | null {
  if (cambiaPlazo(m.tipo)) {
    if (!m.fechaTerminacion) return "Indique la nueva fecha de terminación del contrato.";
    if (fechaTerminacionActual && new Date(`${m.fechaTerminacion}T00:00:00Z`) <= fechaTerminacionActual) {
      return "La nueva fecha de terminación debe ser posterior a la actual.";
    }
  }
  if (cambiaValor(m.tipo) && !m.valorAdicionado) return "Indique el valor adicionado.";
  return null;
}
