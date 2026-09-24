export function documentoEtapaAbierta(pasoNumeroDocumento: number | null, pasoActualNumero: number): boolean {
  return (pasoNumeroDocumento ?? 1) === pasoActualNumero;
}

export function puedeIntentarEliminarDocumento({
  esAdmin,
  esQuienLoSubio,
  etapaAbierta,
}: {
  esAdmin: boolean;
  esQuienLoSubio: boolean;
  etapaAbierta: boolean;
}): boolean {
  if (esAdmin) return true;
  return etapaAbierta && esQuienLoSubio;
}
