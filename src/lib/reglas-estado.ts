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

type OpcionDecision = { siguientePaso?: unknown; resultado?: unknown };

/**
 * Valida que el avance pedido corresponda a lo que el paso actual ofrece en pantalla:
 * en un paso de decisión, una de sus opciones (paso siguiente + resultado); en los demás,
 * el paso inmediatamente siguiente del flujo. Evita saltar pasos o devolverse por esta vía
 * (devolver es solo del administrador, con motivo, en /retroceder).
 */
export function avanceValido(
  pasos: Pick<PasoReglas, "numero" | "esDecision" | "opciones">[],
  pasoActualNumero: number,
  siguientePasoNumero: number | null,
  resultado: string | null
): boolean {
  const ordenados = [...pasos].sort((a, b) => a.numero - b.numero);
  const actual = ordenados.find((p) => p.numero === pasoActualNumero);
  const natural = ordenados.find((p) => p.numero > pasoActualNumero)?.numero ?? null;
  if (actual?.esDecision && Array.isArray(actual.opciones) && actual.opciones.length > 0) {
    return (actual.opciones as OpcionDecision[]).some((o) => {
      const sig = o?.siguientePaso == null || o.siguientePaso === "" ? null : Number(o.siguientePaso);
      const res = typeof o?.resultado === "string" && o.resultado ? o.resultado : null;
      return sig === siguientePasoNumero && res === resultado;
    });
  }
  if (resultado && !resultadosDelPaso(actual).includes(resultado)) return false;
  return siguientePasoNumero === natural;
}
