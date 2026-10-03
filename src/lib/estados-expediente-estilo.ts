export type EstiloEstado = { color: string; etiqueta: string; glifo: string };

const CIRCULO = '<circle cx="12" cy="12" r="10"/>';

export const ESTILO_ESTADO_EXPEDIENTE: Record<string, EstiloEstado> = {
  RADICADO: {
    color: "#2a78d6",
    etiqueta: "Radicado",
    glifo: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  },
  EN_TRAMITE: {
    color: "#eda100",
    etiqueta: "En trámite",
    glifo: `${CIRCULO}<path d="M12 6v6l4 2"/>`,
  },
  INFORMACION_ADICIONAL_REQUERIDA: {
    color: "#eb6834",
    etiqueta: "Información adicional requerida",
    glifo: `${CIRCULO}<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>`,
  },
  SUSPENDIDO: {
    color: "#4a3aa7",
    etiqueta: "Suspendido",
    glifo: `${CIRCULO}<path d="M10 15V9"/><path d="M14 15V9"/>`,
  },
  APROBADO: {
    color: "#008300",
    etiqueta: "Aprobado",
    glifo: '<path d="M20 6 9 17l-5-5"/>',
  },
  NEGADO: {
    color: "#e34948",
    etiqueta: "Negado",
    glifo: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  },
  DESISTIDO: {
    color: "#1baf7a",
    etiqueta: "Desistido",
    glifo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  },
  ARCHIVADO: {
    color: "#898781",
    etiqueta: "Archivado",
    glifo: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  },
  RECHAZADO: {
    color: "#e87ba4",
    etiqueta: "Rechazado",
    glifo: `${CIRCULO}<path d="m4.9 4.9 14.2 14.2"/>`,
  },
};

const ESTILO_DESCONOCIDO: EstiloEstado = { color: "#52514e", etiqueta: "Otro", glifo: CIRCULO };

export function estiloEstado(estado: string): EstiloEstado {
  return ESTILO_ESTADO_EXPEDIENTE[estado] ?? { ...ESTILO_DESCONOCIDO, etiqueta: estado.replaceAll("_", " ") };
}

export function svgPinEstado(estado: string): string {
  const { color, glifo } = estiloEstado(estado);
  return (
    '<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">' +
    `<path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 24 14 24s14-13.5 14-24C28 6.3 21.7 0 14 0z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>` +
    '<circle cx="14" cy="14" r="9" fill="#ffffff"/>' +
    `<g transform="translate(7.5 7.5) scale(0.54)" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${glifo}</g>` +
    "</svg>"
  );
}

export function svgIconoEstado(estado: string, tamano = 16): string {
  const { color, glifo } = estiloEstado(estado);
  return `<svg width="${tamano}" height="${tamano}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${glifo}</svg>`;
}
