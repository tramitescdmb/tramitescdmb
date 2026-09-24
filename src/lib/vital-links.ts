export function urlVitalPublico(idVital: string): string {
  return `https://vital-publico.minambiente.gov.co/buscador?dato=${encodeURIComponent(idVital)}&prefiltro=Todos`;
}
