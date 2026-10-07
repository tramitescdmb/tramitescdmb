type PasoReglas = { numero: number; titulo: string; esDecision: boolean; opciones: unknown };

const ESTADOS_DE_DECISION = ["APROBADO", "NEGADO"] as const;

export function resultadosDelPaso(paso: Pick<PasoReglas, "opciones"> | null | undefined): string[] {
  if (!paso || !Array.isArray(paso.opciones)) return [];
  return (paso.opciones as { resultado?: unknown }[]).map((o) => (typeof o?.resultado === "string" ? o.resultado : "")).filter(Boolean);
}

export function evaluarCambioManualEstado(pasos: PasoReglas[], pasoActualNumero: number, estado: string): { permitido: boolean; motivo: string | null } {
  if (!(ESTADOS_DE_DECISION as readonly string[]).includes(estado)) return { permitido: true, motivo: null };
  const etiqueta = estado === "APROBADO" ? "aprobado" : "negado";
  const pasosDecision = pasos.filter((p) => resultadosDelPaso(p).includes(estado)).sort((a, b) => a.numero - b.numero);
  if (pasosDecision.length > 0) {
    const primero = pasosDecision[0]!;
    if (pasoActualNumero >= primero.numero) return { permitido: true, motivo: null };
    return {
      permitido: false,
      motivo: `El trámite solo puede quedar ${etiqueta} desde el paso ${primero.numero} (${primero.titulo.toLowerCase()}), donde el procedimiento define esa decisión. Está en el paso ${pasoActualNumero}.`,
    };
  }
  const ultimo = [...pasos].sort((a, b) => b.numero - a.numero)[0];
  if (!ultimo || pasoActualNumero >= ultimo.numero) return { permitido: true, motivo: null };
  return {
    permitido: false,
    motivo: `El procedimiento no define un paso de decisión: el trámite solo puede quedar ${etiqueta} en el último paso (${ultimo.numero}, ${ultimo.titulo.toLowerCase()}). Está en el paso ${pasoActualNumero}.`,
  };
}
