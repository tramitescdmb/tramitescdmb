/** Caracterización del usuario de «Mis solicitudes» (sin dependencias de servidor: lo usa el navegador). */
export const TIPOS_USUARIO_CIUDADANO = [
  { valor: "CIUDADANO", etiqueta: "Ciudadano o propietario de predio" },
  { valor: "EMPRESA_PRIVADA", etiqueta: "Empresa privada" },
  { valor: "ENTIDAD_PUBLICA", etiqueta: "Entidad pública" },
  { valor: "ORGANIZACION_SOCIAL", etiqueta: "Organización social, comunitaria o ONG" },
  { valor: "ACADEMIA", etiqueta: "Universidad o centro de investigación" },
  { valor: "CONSULTOR", etiqueta: "Consultor o apoderado que gestiona trámites" },
  { valor: "OTRO", etiqueta: "Otro" },
] as const;
