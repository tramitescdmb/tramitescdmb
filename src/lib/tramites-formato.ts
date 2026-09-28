export function tiempoEstimadoDias(pasos: { tiempoDias: number | null }[]) {
  const conocidos = pasos.filter((p) => p.tiempoDias !== null);
  const total = conocidos.reduce((acc, p) => acc + (p.tiempoDias ?? 0), 0);
  return { total, completo: conocidos.length === pasos.length, pasosConTiempo: conocidos.length, pasosTotal: pasos.length };
}

export function resumenSinPrefijo(texto: string) {
  const sinPrefijo = texto.replace(/^este trámite\s+/i, "");
  if (sinPrefijo === texto) return texto;
  return sinPrefijo.charAt(0).toUpperCase() + sinPrefijo.slice(1);
}
