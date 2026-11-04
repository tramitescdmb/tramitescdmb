// Plantillas de correo: catálogo, palabras reservadas, render y validación.
// Módulo puro (sin base de datos) para usarlo igual en el servidor y en el editor del navegador.
//
// Sintaxis (la misma de las plantillas de documentos del SGDEA):
//   [RADICADO]                 → valor de la palabra reservada
//   [SI:NOMBRE] … [/SI:NOMBRE] → el bloque solo aparece si NOMBRE tiene valor
//   [NO:NOMBRE] … [/NO:NOMBRE] → el bloque solo aparece si NOMBRE está vacío

import type { EventoAviso, Mensaje } from "@/lib/avisos-correo";

export type VariablePlantilla = {
  clave: string;
  descripcion: string;
  ejemplo: string;
  /** El valor ya es HTML (listas): se inserta sin escapar y solo tiene sentido en el cuerpo. */
  html?: boolean;
  /** Debe quedar en el cuerpo de la plantilla; no se puede guardar sin ella. */
  obligatoria?: boolean;
};

export type ContenidoPlantilla = { asunto: string; titulo: string; cuerpo: string; boton: string };

export type DefinicionPlantilla = ContenidoPlantilla & {
  nombre: string;
  descripcion: string;
  grupo: GrupoPlantilla;
  eventos: readonly EventoAviso[];
  variables: VariablePlantilla[];
  /** Sin enlace de destino: el botón no se muestra aunque tenga texto. */
  sinEnlace?: boolean;
};

export type GrupoPlantilla = "FIRMAS" | "VISITAS" | "CONCEPTOS" | "VENCIMIENTOS" | "EXTERNOS" | "ADMINISTRACION";

export const GRUPOS_PLANTILLA: Record<GrupoPlantilla, string> = {
  FIRMAS: "Firmas y vistos buenos",
  VISITAS: "Visitas técnicas",
  CONCEPTOS: "Conceptos técnicos",
  VENCIMIENTOS: "Alertas de vencimiento",
  EXTERNOS: "Ciudadanos y solicitantes",
  ADMINISTRACION: "Correo institucional",
};

/** Palabras reservadas disponibles en todas las plantillas y en el diseño general. */
export const VARIABLES_GLOBALES: VariablePlantilla[] = [
  { clave: "FECHA_HOY", descripcion: "Fecha del envío en letras", ejemplo: "4 de noviembre de 2026" },
  { clave: "URL_PLATAFORMA", descripcion: "Dirección de la plataforma", ejemplo: "https://tramites.cdmb.gov.co" },
  { clave: "ENLACE", descripcion: "Dirección completa del botón del correo (vacía si no hay)", ejemplo: "https://tramites.cdmb.gov.co/firmas/buzon" },
];

const P = (texto: string) => `<p style="margin:0 0 10px">${texto}</p>`;
const PIE_CIUDADANO = "Este correo es una constancia automática; las respuestas se emiten por los canales oficiales de la Corporación.";

const REFERENCIA = { clave: "REFERENCIA", descripcion: "Radicado o número de expediente del documento", ejemplo: "CDMB-E-2026-000123", obligatoria: true } as const;
const DOCUMENTO = { clave: "DOCUMENTO", descripcion: "Nombre del documento", ejemplo: "Auto de inicio", obligatoria: true } as const;

const VARIABLES_NOTIFICACION: VariablePlantilla[] = [
  { clave: "TITULO_AVISO", descripcion: "Título del aviso de la campana (incluye el expediente)", ejemplo: "Visita técnica asignada · SCA-0123-2026" },
  { clave: "EXPEDIENTE", descripcion: "Número del expediente", ejemplo: "SCA-0123-2026" },
  { clave: "MENSAJE", descripcion: "Texto del aviso de la campana", ejemplo: "Se le programó la visita técnica del trámite Concesión de aguas superficiales: lunes 9 de noviembre, 8:00 a. m.", obligatoria: true },
];

function notificacion(evento: EventoAviso, grupo: GrupoPlantilla, nombre: string, descripcion: string, ejemplo: { titulo: string; mensaje: string }): DefinicionPlantilla {
  return {
    nombre,
    descripcion,
    grupo,
    eventos: [evento],
    asunto: "[TITULO_AVISO]",
    titulo: "[TITULO_AVISO]",
    cuerpo: P("[MENSAJE]"),
    boton: "Abrir en la plataforma",
    variables: VARIABLES_NOTIFICACION.map((v) =>
      v.clave === "TITULO_AVISO" ? { ...v, ejemplo: ejemplo.titulo } : v.clave === "MENSAJE" ? { ...v, ejemplo: ejemplo.mensaje } : v
    ),
  };
}

export const PLANTILLAS = {
  FIRMA_SOLICITADA: {
    nombre: "Firma o visto bueno solicitado",
    descripcion: "Se solicita firmar o dar visto bueno a un documento (Trámites, GECON y SGDEA).",
    grupo: "FIRMAS",
    eventos: ["FIRMA_SOLICITADA"],
    asunto: "[TIPO_SOLICITUD] · [REFERENCIA]",
    titulo: "Tiene un documento [PENDIENTE]",
    cuerpo:
      P("<strong>[ASIGNADOR]</strong> le solicitó [ACCION] <strong>[DOCUMENTO]</strong> ([REFERENCIA]).") + P("El documento queda en su buzón de firmas de la plataforma."),
    boton: "Abrir para [ACCION_CORTA]",
    variables: [
      { clave: "ASIGNADOR", descripcion: "Quien solicita la firma", ejemplo: "María Pérez" },
      DOCUMENTO,
      REFERENCIA,
      { clave: "TIPO_SOLICITUD", descripcion: "«Firma solicitada» o «Visto bueno solicitado»", ejemplo: "Firma solicitada" },
      { clave: "PENDIENTE", descripcion: "«por firmar» o «para visto bueno»", ejemplo: "por firmar" },
      { clave: "ACCION", descripcion: "«firmar» o «dar visto bueno a»", ejemplo: "firmar" },
      { clave: "ACCION_CORTA", descripcion: "«firmar» o «dar visto bueno»", ejemplo: "firmar" },
      { clave: "ES_FIRMA", descripcion: "Tiene valor («sí») cuando es firma y está vacía cuando es visto bueno; útil con [SI:ES_FIRMA]", ejemplo: "sí" },
    ],
  },
  FIRMA_RECORDADA: {
    nombre: "Recordatorio de firma",
    descripcion: "Un firmante posterior recuerda una firma pendiente.",
    grupo: "FIRMAS",
    eventos: ["FIRMA_RECORDADA"],
    asunto: "Recordatorio de firma · [REFERENCIA]",
    titulo: "Hay una firma esperando su turno",
    cuerpo: P("<strong>[QUIEN]</strong> espera su firma de <strong>[DOCUMENTO]</strong> ([REFERENCIA]) para poder firmar a continuación."),
    boton: "Abrir para firmar",
    variables: [{ clave: "QUIEN", descripcion: "Firmante que envía el recordatorio", ejemplo: "Carlos Gómez" }, DOCUMENTO, REFERENCIA],
  },
  FIRMA_RECHAZADA: {
    nombre: "Firma o visto bueno rechazado",
    descripcion: "Se rechaza una firma o un visto bueno; le llega a quien cargó o proyectó el documento.",
    grupo: "FIRMAS",
    eventos: ["FIRMA_RECHAZADA"],
    asunto: "[TIPO_RECHAZO] · [REFERENCIA]",
    titulo: "Se rechazó [OBJETO] de un documento",
    cuerpo: P("<strong>[QUIEN]</strong> rechazó <strong>[DOCUMENTO]</strong> ([REFERENCIA]).") + P("Motivo: [MOTIVO]"),
    boton: "Abrir el documento",
    variables: [
      { clave: "QUIEN", descripcion: "Quien rechazó", ejemplo: "Carlos Gómez" },
      DOCUMENTO,
      REFERENCIA,
      { clave: "MOTIVO", descripcion: "Motivo del rechazo", ejemplo: "Revisar el número de radicado citado en el asunto.", obligatoria: true },
      { clave: "TIPO_RECHAZO", descripcion: "«Firma rechazada» o «Visto bueno rechazado»", ejemplo: "Firma rechazada" },
      { clave: "OBJETO", descripcion: "«la firma» o «el visto bueno»", ejemplo: "la firma" },
    ],
  },
  VISITA_SIN_PROGRAMAR: notificacion("VISITA_SIN_PROGRAMAR", "VISITAS", "Visita por programar", "Un expediente llega a un paso que requiere visita técnica.", {
    titulo: "Programar visita técnica · SCA-0123-2026",
    mensaje: "El trámite Concesión de aguas superficiales llegó al paso 4 (visita técnica) y requiere visita técnica. Asigne el personal y programe la visita.",
  }),
  VISITA_NO_REALIZADA: notificacion("VISITA_NO_REALIZADA", "VISITAS", "Visita no realizada", "Una visita no se realizó y debe reprogramarse.", {
    titulo: "Reprogramar visita · SCA-0123-2026",
    mensaje: "La última visita del trámite Concesión de aguas superficiales no se pudo realizar y está en el paso 4 (visita técnica). Debe reprogramarse.",
  }),
  VISITA_PROGRAMADA: notificacion("VISITA_PROGRAMADA", "VISITAS", "Visita programada", "Se programa una visita o se agrega a alguien al equipo.", {
    titulo: "Visita técnica asignada · SCA-0123-2026",
    mensaje: "Se le programó la visita técnica del trámite Concesión de aguas superficiales: lunes 9 de noviembre, 8:00 a. m. a 12:00 m., vereda de ejemplo.",
  }),
  VISITA_REPROGRAMADA: notificacion("VISITA_REPROGRAMADA", "VISITAS", "Visita reprogramada", "Se cambia la fecha, hora o lugar de una visita.", {
    titulo: "Visita técnica reprogramada · SCA-0123-2026",
    mensaje: "Se reprogramó su visita técnica del trámite Concesión de aguas superficiales: martes 10 de noviembre, 8:00 a. m. a 12:00 m., vereda de ejemplo.",
  }),
  VISITA_CANCELADA: notificacion("VISITA_CANCELADA", "VISITAS", "Visita cancelada", "Se cancela una visita.", {
    titulo: "Visita técnica cancelada · SCA-0123-2026",
    mensaje: "Se canceló su visita técnica del trámite Concesión de aguas superficiales: lunes 9 de noviembre, 8:00 a. m. Motivo: el solicitante pidió aplazarla.",
  }),
  CONCEPTO_POR_ELABORAR: notificacion("CONCEPTO_POR_ELABORAR", "CONCEPTOS", "Concepto por elaborar", "El expediente llega al paso de concepto técnico.", {
    titulo: "Elaborar concepto técnico · SCA-0123-2026",
    mensaje: "El trámite Concesión de aguas superficiales llegó al paso 5 (concepto técnico). Le corresponde elaborar el concepto técnico.",
  }),
  CONCEPTO_EN_REVISION: notificacion("CONCEPTO_EN_REVISION", "CONCEPTOS", "Concepto en revisión", "Un concepto se envía a revisión.", {
    titulo: "Concepto por revisar · SCA-0123-2026",
    mensaje: "El profesional envió el concepto técnico a revisión. Apruébelo y envíelo a firma, o devuélvalo con observaciones.",
  }),
  CONCEPTO_DEVUELTO: notificacion("CONCEPTO_DEVUELTO", "CONCEPTOS", "Concepto devuelto", "Un concepto se devuelve o se reabre para corrección.", {
    titulo: "Concepto devuelto · SCA-0123-2026",
    mensaje: "Quien revisa devolvió el concepto técnico: ajustar el caudal recomendado al aforo registrado en la visita.",
  }),
  CONCEPTO_FIRMADO: notificacion("CONCEPTO_FIRMADO", "CONCEPTOS", "Concepto firmado", "Todo el equipo firmó el concepto.", {
    titulo: "Concepto 0001 firmado · SCA-0123-2026",
    mensaje: "Todas las personas del equipo firmaron o dieron visto bueno al concepto técnico.",
  }),
  CONCEPTO_RECHAZADO: notificacion("CONCEPTO_RECHAZADO", "CONCEPTOS", "Concepto rechazado", "Se rechaza la firma de un concepto.", {
    titulo: "Concepto 0001 rechazado · SCA-0123-2026",
    mensaje: "Se rechazó la firma del concepto técnico: falta el registro fotográfico del punto de captación. Quien planea las visitas puede reabrirlo para corrección.",
  }),
  RESUMEN_VENCIMIENTOS: {
    nombre: "Resumen diario de alertas de vencimiento",
    descripcion:
      "Un solo correo diario por persona con sus alertas nuevas: PQRSD y memorandos por vencer, pasos de flujo, informes de contratos atrasados y firmas sin atender.",
    grupo: "VENCIMIENTOS",
    eventos: ["PQRSD_POR_VENCER", "MEMORANDO_POR_VENCER", "FLUJO_POR_VENCER", "INFORME_ATRASADO", "FIRMA_SIN_ATENDER"],
    asunto: "[CANTIDAD] alerta(s) de vencimiento[SI:VENCIDAS] — [VENCIDAS] vencida(s)[/SI:VENCIDAS] · Plataforma CDMB",
    titulo: "Alertas de vencimiento",
    cuerpo: "[LISTA_ALERTAS]",
    boton: "Ir a la plataforma",
    variables: [
      {
        clave: "LISTA_ALERTAS",
        descripcion: "Las últimas alertas de la persona agrupadas (PQRSD, memorandos, pasos de flujo, informes, firmas), cada una con su enlace",
        ejemplo:
          '<p style="margin:16px 0 6px;font-weight:600">PQRSD</p><ul style="margin:0;padding-left:18px"><li style="margin:0 0 6px;color:#b91c1c"><a href="#" style="color:#038F67">CDMB-R-2026-000456 — venció el 2 nov · Derecho de petición sobre vertimientos</a></li><li style="margin:0 0 6px"><a href="#" style="color:#038F67">CDMB-R-2026-000470 — vence el 6 nov · Solicitud de información de una concesión</a></li></ul><p style="margin:16px 0 6px;font-weight:600">Firmas sin atender</p><ul style="margin:0;padding-left:18px"><li style="margin:0 0 6px"><a href="#" style="color:#038F67">Firmar: Auto de inicio (SCA-0123-2026) — asignada hace 3 día(s)</a></li></ul>',
        html: true,
        obligatoria: true,
      },
      { clave: "CANTIDAD", descripcion: "Número de alertas del correo", ejemplo: "3" },
      { clave: "VENCIDAS", descripcion: "Número de alertas ya vencidas (vacía si no hay)", ejemplo: "1" },
      { clave: "PQRSD", descripcion: "Número de PQRSD por vencer o vencidas (vacía si no hay)", ejemplo: "2" },
      { clave: "FIRMAS", descripcion: "Número de firmas sin atender (vacía si no hay)", ejemplo: "1" },
    ],
  },
  PQRSD_RADICADO: {
    nombre: "PQRSD radicada (al ciudadano)",
    descripcion: "Constancia al ciudadano cuando se radica su PQRSD por la web o en ventanilla, si dejó correo.",
    grupo: "EXTERNOS",
    eventos: ["PQRSD_RADICADO"],
    asunto: "Radicado [RADICADO] · CDMB",
    titulo: "Su solicitud quedó radicada",
    cuerpo: [
      "[SI:NOMBRE]" + P("Señor(a) <strong>[NOMBRE]</strong>:") + "[/SI:NOMBRE]",
      P("La Corporación recibió su solicitud el [FECHA_RADICACION] con el radicado <strong>[RADICADO]</strong>."),
      P("Tipo de solicitud: [TIPO_PQRSD]"),
      P("Asunto: [ASUNTO]"),
      "[SI:FECHA_VENCIMIENTO]" + P("El término legal de respuesta vence el [FECHA_VENCIMIENTO].") + "[/SI:FECHA_VENCIMIENTO]",
      P("Conserve el número de radicado para consultar el estado de su solicitud."),
      P(PIE_CIUDADANO),
    ].join("\n"),
    boton: "Consultar el estado",
    variables: [
      { clave: "RADICADO", descripcion: "Número de radicado de la PQRSD", ejemplo: "CDMB-R-2026-000470", obligatoria: true },
      { clave: "NOMBRE", descripcion: "Nombre del ciudadano (vacía si es anónima)", ejemplo: "Ana Rodríguez" },
      { clave: "FECHA_RADICACION", descripcion: "Fecha de radicación en letras", ejemplo: "4 de noviembre de 2026" },
      { clave: "TIPO_PQRSD", descripcion: "Tipo de solicitud", ejemplo: "Petición general" },
      { clave: "ASUNTO", descripcion: "Asunto de la solicitud", ejemplo: "Solicitud de información sobre el estado de una concesión de aguas" },
      { clave: "FECHA_VENCIMIENTO", descripcion: "Vencimiento del término legal de respuesta (vacía si no aplica)", ejemplo: "26 de noviembre de 2026" },
    ],
  },
  PQRSD_RESPUESTA: {
    nombre: "Respuesta a una PQRSD (al ciudadano)",
    descripcion: "Se despacha el oficio que responde una PQRSD.",
    grupo: "EXTERNOS",
    eventos: ["PQRSD_RESPUESTA"],
    asunto: "Respuesta a su radicado [RADICADO] · CDMB",
    titulo: "Se emitió la respuesta a su solicitud",
    cuerpo: [
      "[SI:NOMBRE]" + P("Señor(a) <strong>[NOMBRE]</strong>:") + "[/SI:NOMBRE]",
      P("La Corporación emitió la respuesta a su solicitud con radicado <strong>[RADICADO]</strong> mediante el oficio <strong>[OFICIO]</strong>."),
      P("Asunto: [ASUNTO]"),
      P("Medio de entrega: [MEDIO]."),
      P(PIE_CIUDADANO),
    ].join("\n"),
    boton: "Consultar el estado",
    variables: [
      { clave: "RADICADO", descripcion: "Radicado de la PQRSD que se responde", ejemplo: "CDMB-R-2026-000470", obligatoria: true },
      { clave: "OFICIO", descripcion: "Radicado del oficio de respuesta", ejemplo: "CDMB-E-2026-000812", obligatoria: true },
      { clave: "NOMBRE", descripcion: "Nombre del ciudadano (vacía si no se conoce)", ejemplo: "Ana Rodríguez" },
      { clave: "ASUNTO", descripcion: "Asunto de la solicitud", ejemplo: "Solicitud de información sobre el estado de una concesión de aguas" },
      { clave: "MEDIO", descripcion: "Medio de entrega del oficio", ejemplo: "Correo electrónico" },
    ],
  },
  TRAMITE_RADICADO: {
    nombre: "Trámite ambiental radicado (al solicitante)",
    descripcion: "Se radica un expediente de trámite y el solicitante tiene correo.",
    grupo: "EXTERNOS",
    eventos: ["TRAMITE_RADICADO"],
    asunto: "Expediente [EXPEDIENTE] · CDMB",
    titulo: "Su trámite ambiental quedó radicado",
    cuerpo: [
      P("Señor(a) <strong>[NOMBRE]</strong>:"),
      P("El [FECHA_RADICACION] se radicó su solicitud de <strong>[TRAMITE]</strong> con el número de expediente <strong>[EXPEDIENTE]</strong>."),
      P("Cite este número en cualquier comunicación relacionada con el trámite."),
      P(PIE_CIUDADANO),
    ].join("\n"),
    boton: "",
    sinEnlace: true,
    variables: [
      { clave: "EXPEDIENTE", descripcion: "Número del expediente", ejemplo: "SCA-0123-2026", obligatoria: true },
      { clave: "NOMBRE", descripcion: "Nombre del solicitante", ejemplo: "Agropecuaria El Roble S.A.S." },
      { clave: "TRAMITE", descripcion: "Trámite ambiental solicitado", ejemplo: "Concesión de aguas superficiales" },
      { clave: "FECHA_RADICACION", descripcion: "Fecha de radicación en letras", ejemplo: "4 de noviembre de 2026" },
    ],
  },
  ADMIN_CORREO: {
    nombre: "Novedades del correo (al administrador)",
    descripcion: "Direcciones inexistentes, envíos descartados y claves del correo por vencer; sale con el mantenimiento diario.",
    grupo: "ADMINISTRACION",
    eventos: ["ADMIN_CORREO"],
    asunto: "Correo institucional: [CANTIDAD] novedad(es) · Plataforma CDMB",
    titulo: "Novedades del correo institucional",
    cuerpo: "[LISTA_NOVEDADES]",
    boton: "Abrir el correo institucional",
    variables: [
      {
        clave: "LISTA_NOVEDADES",
        descripcion: "Las novedades agrupadas (direcciones inexistentes, envíos descartados, cuentas de correo), cada una con su enlace",
        ejemplo:
          '<p style="margin:16px 0 6px;font-weight:600">Direcciones inexistentes</p><ul style="margin:0;padding-left:18px"><li style="margin:0 0 6px;color:#b91c1c"><a href="#" style="color:#038F67">persona.inexistente@hotmail.com — 5.1.1; se dejó de enviar a esta dirección</a></li></ul>',
        html: true,
        obligatoria: true,
      },
      { clave: "CANTIDAD", descripcion: "Número de novedades", ejemplo: "1" },
    ],
  },
} satisfies Record<string, DefinicionPlantilla>;

export type ClavePlantilla = keyof typeof PLANTILLAS;

export const CLAVES_PLANTILLA = Object.keys(PLANTILLAS) as ClavePlantilla[];

export function esClavePlantilla(valor: string): valor is ClavePlantilla {
  return Object.prototype.hasOwnProperty.call(PLANTILLAS, valor);
}

export function definicionPlantilla(clave: ClavePlantilla): DefinicionPlantilla {
  return PLANTILLAS[clave];
}

const PLANTILLA_DE_EVENTO = new Map<string, ClavePlantilla>(CLAVES_PLANTILLA.flatMap((c) => PLANTILLAS[c].eventos.map((e) => [e, c] as const)));

export function plantillaDeEvento(evento: EventoAviso): ClavePlantilla {
  return PLANTILLA_DE_EVENTO.get(evento)!;
}

export function variablesDe(clave: ClavePlantilla): VariablePlantilla[] {
  return [...PLANTILLAS[clave].variables, ...VARIABLES_GLOBALES];
}

export function ejemplosDe(variables: VariablePlantilla[]): Record<string, string> {
  return Object.fromEntries(variables.map((v) => [v.clave, v.ejemplo]));
}

// ── Diseño general (marco común de todos los correos) ──────────────────────────────────────────

export type DisenoCorreo = { antetitulo: string; encabezado: string; pie: string };

export const DISENO_PREDETERMINADO: DisenoCorreo = {
  antetitulo: "CDMB · Plataforma de trámites",
  encabezado: "",
  pie: "Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga — mensaje automático, por favor no responda a este correo.",
};

export const CLAVE_DISENO = "DISENO";

// ── Render ─────────────────────────────────────────────────────────────────────────────────────

export function escaparHtmlPlantilla(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function quitarEtiquetas(html: string): string {
  return html
    .replace(/<\/(p|li|div|h\d)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const PALABRA = /\[([A-Z][A-Z0-9_]*)\]/g;
const SECCION = /\[(SI|NO):([A-Z][A-Z0-9_]*)\]([\s\S]*?)\[\/\1:\2\]/g;
const APERTURA = /\[(SI|NO):([A-Z][A-Z0-9_]*)\]/g;
const CIERRE = /\[\/(SI|NO):([A-Z][A-Z0-9_]*)\]/g;

export type Valores = Record<string, string | null | undefined>;

/**
 * Reemplaza las palabras reservadas. En modo «html» los valores se escapan (salvo las variables
 * HTML, que se insertan tal cual); en modo «texto» (asunto, título, botón) las variables HTML
 * se reducen a texto y nada se escapa: quien inserta el resultado en HTML lo escapa.
 */
export function renderizarTexto(plantilla: string, valores: Valores, modo: "html" | "texto", variablesHtml: ReadonlySet<string> = new Set()): string {
  let texto = plantilla;
  for (let i = 0; i < 5; i++) {
    const siguiente = texto.replace(SECCION, (_t, tipo: string, clave: string, contenido: string) => {
      const lleno = Boolean(valores[clave]?.trim());
      return (tipo === "SI") === lleno ? contenido : "";
    });
    if (siguiente === texto) break;
    texto = siguiente;
  }
  return texto.replace(PALABRA, (original, clave: string) => {
    if (!Object.prototype.hasOwnProperty.call(valores, clave)) return original;
    const valor = valores[clave] ?? "";
    if (variablesHtml.has(clave)) return modo === "html" ? valor : quitarEtiquetas(valor);
    return modo === "html" ? escaparHtmlPlantilla(valor) : valor;
  });
}

export type MensajeRenderizado = { asunto: string; titulo: string; cuerpoHtml: string; boton: string };

export function renderizarPlantilla(clave: ClavePlantilla, contenido: ContenidoPlantilla, valores: Valores): MensajeRenderizado {
  const html = new Set(variablesDe(clave).filter((v) => v.html).map((v) => v.clave));
  const texto = (t: string) => renderizarTexto(t, valores, "texto", html).replace(/\s+/g, " ").trim();
  return {
    asunto: texto(contenido.asunto).slice(0, 300),
    titulo: texto(contenido.titulo),
    cuerpoHtml: renderizarTexto(contenido.cuerpo, valores, "html", html),
    boton: texto(contenido.boton),
  };
}

/** Construye el mensaje con la plantilla predeterminada; al enviar se aplica la personalizada si existe. */
export function componerMensaje(clave: ClavePlantilla, valores: Valores, ruta?: string): Mensaje {
  const def = PLANTILLAS[clave] as DefinicionPlantilla;
  const r = renderizarPlantilla(clave, def, valores);
  return {
    asunto: r.asunto,
    titulo: r.titulo,
    cuerpoHtml: r.cuerpoHtml,
    enlace: !def.sinEnlace && ruta && r.boton ? { texto: r.boton, ruta } : undefined,
    plantilla: { clave, valores, ruta },
  };
}

export function botonCorreo(texto: string, url: string): string {
  return `<p style="margin:20px 0"><a href="${escaparHtmlPlantilla(url)}" style="background:#038F67;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">${escaparHtmlPlantilla(texto)}</a></p>`;
}

/** Marco común del correo. `titulo` ya viene escapado; `cuerpoHtml` y el diseño ya vienen renderizados. */
export function envolverCorreo(titulo: string, cuerpoHtml: string, enlace: { texto: string; url: string } | undefined, diseno: DisenoCorreo = DISENO_PREDETERMINADO): string {
  const boton = enlace && enlace.texto.trim() ? botonCorreo(enlace.texto, enlace.url) : "";
  const antetitulo = diseno.antetitulo.trim()
    ? `<p style="font-size:12px;color:#038F67;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin:0 0 8px">${escaparHtmlPlantilla(diseno.antetitulo.trim())}</p>\n`
    : "";
  const encabezado = diseno.encabezado.trim() ? `<div style="margin:0 0 14px">${diseno.encabezado}</div>\n` : "";
  const pie = diseno.pie.trim() ? `<div style="font-size:11px;color:#78716c;border-top:1px solid #e7e5e4;padding-top:10px;margin-top:24px">${diseno.pie}</div>` : "";
  return `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;color:#1c1917;max-width:600px">
${encabezado}${antetitulo}<h2 style="font-size:18px;margin:0 0 12px">${titulo}</h2>
${cuerpoHtml}
${boton}
${pie}
</div>`;
}

/** Renderiza el diseño general con las palabras globales (el pie y el encabezado admiten HTML). */
export function renderizarDiseno(diseno: DisenoCorreo, valores: Valores): DisenoCorreo {
  return {
    antetitulo: renderizarTexto(diseno.antetitulo, valores, "texto"),
    encabezado: renderizarTexto(diseno.encabezado, valores, "html"),
    pie: renderizarTexto(diseno.pie, valores, "html"),
  };
}

export function fechaEnLetras(d: Date): string {
  return d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric" });
}

// ── Limpieza y validación ──────────────────────────────────────────────────────────────────────

const PARRAFO_SIN_ESTILO = /<p>/gi;

/** Quita lo que no debe ir en un correo (scripts, marcos, eventos, javascript:) y da margen a los párrafos sin estilo. */
export function limpiarHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|textarea|select|button)\b[\s\S]*?<\/\s*\1\s*>/gi, "")
    .replace(/<\/?\s*(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base)\b[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"')
    .replace(PARRAFO_SIN_ESTILO, '<p style="margin:0 0 10px">')
    .trim();
}

export const MAX_CUERPO = 60_000;

export type ResultadoValidacion = { ok: boolean; errores: string[]; faltantes: string[]; desconocidas: string[] };

function palabrasUsadas(texto: string): string[] {
  const sinSecciones = texto.replace(APERTURA, (_t, _tipo, clave: string) => `[${clave}]`).replace(CIERRE, "");
  return [...new Set([...sinSecciones.matchAll(PALABRA)].map((m) => m[1]!))];
}

function seccionesBalanceadas(texto: string): string[] {
  const errores: string[] = [];
  const abiertas = [...texto.matchAll(APERTURA)].map((m) => `${m[1]}:${m[2]}`);
  const cerradas = [...texto.matchAll(CIERRE)].map((m) => `${m[1]}:${m[2]}`);
  for (const a of new Set([...abiertas, ...cerradas])) {
    const n = abiertas.filter((x) => x === a).length;
    const c = cerradas.filter((x) => x === a).length;
    if (n !== c) errores.push(`El bloque [${a}] no está bien cerrado: debe terminar con [/${a}].`);
  }
  return errores;
}

export function validarPlantilla(clave: ClavePlantilla, c: ContenidoPlantilla): ResultadoValidacion {
  const variables = variablesDe(clave);
  const conocidas = new Set(variables.map((v) => v.clave));
  const errores: string[] = [];
  if (!c.asunto.trim()) errores.push("El asunto no puede quedar vacío.");
  if (c.asunto.length > 250) errores.push("El asunto no puede superar 250 caracteres.");
  if (!c.titulo.trim()) errores.push("El título no puede quedar vacío.");
  if (c.titulo.length > 250) errores.push("El título no puede superar 250 caracteres.");
  if (c.boton.length > 80) errores.push("El texto del botón no puede superar 80 caracteres.");
  if (!c.cuerpo.trim()) errores.push("El cuerpo no puede quedar vacío.");
  if (c.cuerpo.length > MAX_CUERPO) errores.push(`El cuerpo no puede superar ${MAX_CUERPO.toLocaleString("es-CO")} caracteres.`);
  if (/src\s*=\s*["']?\s*data:/i.test(c.cuerpo)) errores.push("Las imágenes deben subirse o enlazarse por dirección (https://); Outlook bloquea las imágenes incrustadas.");
  for (const campo of [c.asunto, c.titulo, c.cuerpo, c.boton]) errores.push(...seccionesBalanceadas(campo));
  const usadasCuerpo = new Set(palabrasUsadas(c.cuerpo));
  const faltantes = variables.filter((v) => v.obligatoria && !usadasCuerpo.has(v.clave)).map((v) => v.clave);
  for (const f of faltantes) errores.push(`Falta la palabra reservada obligatoria [${f}] en el cuerpo.`);
  const desconocidas = [...new Set([c.asunto, c.titulo, c.cuerpo, c.boton].flatMap(palabrasUsadas))].filter((p) => !conocidas.has(p));
  for (const d of desconocidas) errores.push(`[${d}] no es una palabra reservada de esta plantilla.`);
  return { ok: errores.length === 0, errores: [...new Set(errores)], faltantes, desconocidas };
}

export function validarDiseno(d: DisenoCorreo): ResultadoValidacion {
  const conocidas = new Set(VARIABLES_GLOBALES.map((v) => v.clave));
  const errores: string[] = [];
  if (d.antetitulo.length > 120) errores.push("El antetítulo no puede superar 120 caracteres.");
  for (const [nombre, valor] of [["encabezado", d.encabezado], ["pie", d.pie]] as const) {
    if (valor.length > MAX_CUERPO) errores.push(`El ${nombre} no puede superar ${MAX_CUERPO.toLocaleString("es-CO")} caracteres.`);
    if (/src\s*=\s*["']?\s*data:/i.test(valor)) errores.push(`Las imágenes del ${nombre} deben subirse o enlazarse por dirección (https://).`);
  }
  for (const campo of [d.antetitulo, d.encabezado, d.pie]) errores.push(...seccionesBalanceadas(campo));
  const desconocidas = [...new Set([d.antetitulo, d.encabezado, d.pie].flatMap(palabrasUsadas))].filter((p) => !conocidas.has(p));
  for (const x of desconocidas) errores.push(`[${x}] no es una palabra reservada del diseño general.`);
  return { ok: errores.length === 0, errores, faltantes: [], desconocidas };
}
