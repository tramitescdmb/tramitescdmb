export const TRAMITES_CON_DATOS_PREDIO = new Set([
  "M-DA-PR05",
  "M-DA-PR21",
  "M-DA-PR33",
  "M-DA-PR41",
  "M-DA-PR60",
  "M-DA-PR66",
  "M-DA-PR67",
  "M-DA-PR69",
  "M-DA-PR70",
]);

export function aplicaDatosPredio(codigoTramite: string): boolean {
  return TRAMITES_CON_DATOS_PREDIO.has(codigoTramite);
}
