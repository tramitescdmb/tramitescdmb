/**
 * Únicas 5 opciones de régimen tributario que maneja el sistema — deliberadamente
 * básico (no replica el formulario contable completo del sistema legado), ver
 * memoria de proyecto sobre el registro maestro de Solicitante.
 */
export const REGIMENES_TRIBUTARIOS = [
  { value: "RESPONSABLE_IVA", label: "Responsable de IVA" },
  { value: "NO_RESPONSABLE_IVA", label: "No responsable de IVA" },
  { value: "SIMPLE_TRIBUTACION", label: "Régimen simple de tributación" },
  { value: "REGIMEN_ESPECIAL", label: "Régimen especial" },
  { value: "OTRO", label: "Otro" },
] as const;

export function regimenTributarioLabel(valor: string | null | undefined): string {
  return REGIMENES_TRIBUTARIOS.find((r) => r.value === valor)?.label ?? "—";
}
