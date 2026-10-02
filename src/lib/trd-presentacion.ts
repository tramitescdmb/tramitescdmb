export const ETIQUETA_DISPOSICION: Record<string, string> = {
  CONSERVACION_TOTAL: "Conservación total",
  ELIMINACION: "Eliminación",
  SELECCION: "Selección",
  MICROFILMACION_DIGITALIZACION: "Microfilmación / Digitalización",
};

export type SubserieBuscable = {
  id: string;
  codigo: string;
  nombre: string;
  retencionGestionAnios?: number;
  retencionCentralAnios?: number;
  disposicionesFinal?: string[];
};

export function subserieBuscable(ss: {
  id: string;
  codigo: string;
  nombre: string;
  retencionGestionAnios: number;
  retencionCentralAnios: number;
  disposicionesFinal: string[];
}): SubserieBuscable {
  return {
    id: ss.id,
    codigo: ss.codigo,
    nombre: ss.nombre,
    retencionGestionAnios: ss.retencionGestionAnios,
    retencionCentralAnios: ss.retencionCentralAnios,
    disposicionesFinal: ss.disposicionesFinal,
  };
}

export function esSerieSinSubseries(serie: { codigo: string; subseries: { codigo: string }[] }): boolean {
  return serie.subseries.length === 1 && serie.subseries[0]!.codigo === serie.codigo;
}

export function resumenRetencion(ss: SubserieBuscable): string | null {
  if (ss.retencionGestionAnios === undefined || ss.retencionCentralAnios === undefined) return null;
  const anios = (n: number) => `${n} ${n === 1 ? "año" : "años"}`;
  const disposicion = (ss.disposicionesFinal ?? []).map((d) => ETIQUETA_DISPOSICION[d] ?? d).join(", ");
  return `Archivo de gestión: ${anios(ss.retencionGestionAnios)} · Archivo central: ${anios(ss.retencionCentralAnios)}${disposicion ? ` · Disposición final: ${disposicion}` : ""}`;
}
