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

/** Estados que cierran el trámite antes de la decisión de fondo: siempre lo finalizan. */
export const CIERRES_ANTICIPADOS = ["DESISTIDO", "ARCHIVADO", "RECHAZADO"] as const;

/**
 * Resultado con que puede quedar un trámite que llega al último paso sin estado final: los que
 * define su paso de decisión (aprobado/negado); si el procedimiento no tiene decisión (registros,
 * certificaciones, entregas), se finaliza como aprobado (atendido).
 */
export function resultadosFinalesDelFlujo(pasos: Pick<PasoReglas, "opciones">[]): string[] {
  const usados = new Set(pasos.flatMap((p) => resultadosDelPaso(p)));
  const r = ESTADOS_DE_DECISION.filter((e) => usados.has(e));
  return r.length > 0 ? [...r] : ["APROBADO"];
}

/**
 * ¿Se puede finalizar el trámite desde el paso actual, y con qué resultado?
 * - Desistido/archivado/rechazado (sin finalizar): sí, conservando ese estado.
 * - Último paso del procedimiento: sí; si ya está aprobado/negado lo conserva, y si no tiene
 *   estado final se escoge entre los resultados del procedimiento.
 * - En cualquier otro paso: no (faltan pasos).
 * `resultados` vacío = se conserva el estado actual.
 */
export function opcionFinalizar(
  pasos: Pick<PasoReglas, "numero" | "opciones">[],
  pasoActualNumero: number,
  estado: string
): { puede: boolean; resultados: string[] } {
  if ((CIERRES_ANTICIPADOS as readonly string[]).includes(estado)) return { puede: true, resultados: [] };
  const hayPasoSiguiente = pasos.some((p) => p.numero > pasoActualNumero);
  if (hayPasoSiguiente) return { puede: false, resultados: [] };
  if ((ESTADOS_DE_DECISION as readonly string[]).includes(estado)) return { puede: true, resultados: [] };
  return { puede: true, resultados: resultadosFinalesDelFlujo(pasos) };
}
