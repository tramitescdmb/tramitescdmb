export type TipoIdentificacionFirmaValor = "CC" | "NIT";

export const TIPOS_IDENTIFICACION_FIRMA: TipoIdentificacionFirmaValor[] = ["CC", "NIT"];

export const ETIQUETA_TIPO_IDENTIFICACION: Record<TipoIdentificacionFirmaValor, string> = {
  CC: "Cédula de ciudadanía",
  NIT: "NIT",
};

export function esTipoIdentificacionFirma(valor: unknown): valor is TipoIdentificacionFirmaValor {
  return valor === "CC" || valor === "NIT";
}

export function textoIdentificacionFirma(numero: string | null | undefined, tipo: string | null | undefined): string | null {
  const n = numero?.trim();
  if (!n) return null;
  if (tipo === "NIT") return `NIT ${n}`;
  if (tipo === "CC") return `C.C. ${n}`;
  return `C.C./NIT ${n}`;
}

export function etiquetaDatoIdentificacion(tipo: string | null | undefined): string {
  if (tipo === "NIT") return "NIT";
  if (tipo === "CC") return "Cédula de ciudadanía";
  return "Cédula o NIT";
}
