export type RutasFirmas = { buzon: string; misFirmas: string; rechazos: string };

export const RUTAS_FIRMAS_TRAMITES: RutasFirmas = {
  buzon: "/firmas/buzon",
  misFirmas: "/firmas/mis-firmas",
  rechazos: "/firmas/rechazos",
};

export const RUTAS_FIRMAS_SIGEC: RutasFirmas = {
  buzon: "/contratacion/buzon",
  misFirmas: "/contratacion/mis-firmas",
  rechazos: "/contratacion/rechazos-firma",
};
