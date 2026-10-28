import type { AmbitoFlujo, TipoComunicacion } from "@prisma/client";

export type TipoPasoPlantilla = "TAREA" | "REVISION" | "DECISION" | "FIRMA" | "FIN";
export type AsignacionPlantilla =
  | "DEPENDENCIA_COMUNICACION"
  | "DEPENDENCIA_FIJA"
  | "CARGO"
  | "RADICADOR"
  | "RESPONSABLE_PASO_ANTERIOR"
  | "MANUAL"
  | "PERSONAL_ASIGNADO"
  | "SUPERVISOR";

export type PasoPlantilla = {
  clave: string;
  nombre: string;
  tipo: TipoPasoPlantilla;
  asignacion: AsignacionPlantilla;
  cargoClave?: string;
  slaDiasHabiles?: number;
  instrucciones?: string;
  transiciones?: { etiqueta: string; hacia: string }[];
};

export type PlantillaFlujo = {
  nombre: string;
  descripcion: string;
  aplicaA: TipoComunicacion | null;
  ambito?: AmbitoFlujo;
  pasos: PasoPlantilla[];
};

export const PLANTILLAS_FLUJO: PlantillaFlujo[] = [
  {
    nombre: "Gestión de PQRSD con visto bueno",
    descripcion:
      "Proyección de la respuesta en la dependencia, visto bueno interno y radicación formal de la salida. Devuelve al proyector si el visto bueno no aprueba.",
    aplicaA: "RECIBIDA",
    pasos: [
      {
        clave: "proyeccion",
        nombre: "Proyección de la respuesta",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 8,
        instrucciones: "Estudie el fondo de la petición y redacte el proyecto de respuesta con sus soportes.",
        transiciones: [{ etiqueta: "Enviar a visto bueno", hacia: "visto_bueno" }],
      },
      {
        clave: "visto_bueno",
        nombre: "Visto bueno",
        tipo: "REVISION",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 2,
        instrucciones: "Revise el proyecto de respuesta. Apruébelo para radicación o devuélvalo con observaciones.",
        transiciones: [
          { etiqueta: "Aprobar", hacia: "radicacion" },
          { etiqueta: "Devolver para ajustes", hacia: "proyeccion" },
        ],
      },
      {
        clave: "radicacion",
        nombre: "Radicación de la respuesta",
        tipo: "TAREA",
        asignacion: "RADICADOR",
        slaDiasHabiles: 2,
        instrucciones: "Radique la respuesta como oficio de salida enlazado a esta comunicación (Responde a).",
        transiciones: [{ etiqueta: "Respuesta radicada", hacia: "cierre" }],
      },
      { clave: "cierre", nombre: "Cierre del trámite", tipo: "FIN", asignacion: "DEPENDENCIA_COMUNICACION" },
    ],
  },
  {
    nombre: "Oficio de salida con revisión y firma",
    descripcion:
      "Redacción del oficio en la dependencia productora, revisión, firma electrónica y despacho. Devuelve al redactor si la revisión no aprueba o si un firmante rechaza.",
    aplicaA: "ENVIADA",
    pasos: [
      {
        clave: "redaccion",
        nombre: "Redacción del oficio",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 3,
        instrucciones: "Redacte el oficio de salida y adjunte los anexos que correspondan.",
        transiciones: [{ etiqueta: "Pasar a revisión", hacia: "revision" }],
      },
      {
        clave: "revision",
        nombre: "Revisión",
        tipo: "REVISION",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 2,
        instrucciones: "Revise el contenido y la forma. Apruébelo para firma o devuélvalo con observaciones.",
        transiciones: [
          { etiqueta: "Aprobar para firma", hacia: "firma" },
          { etiqueta: "Devolver", hacia: "redaccion" },
        ],
      },
      {
        clave: "firma",
        nombre: "Firma electrónica",
        tipo: "FIRMA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 3,
        instrucciones: "Asigne los firmantes del oficio. El flujo avanza solo cuando todos firman; si alguien rechaza, vuelve a redacción.",
        transiciones: [
          { etiqueta: "Firmado", hacia: "despacho" },
          { etiqueta: "Rechazado", hacia: "redaccion" },
        ],
      },
      { clave: "despacho", nombre: "Despacho y archivo", tipo: "FIN", asignacion: "DEPENDENCIA_COMUNICACION" },
    ],
  },
  {
    nombre: "Trámite de memorando interno",
    descripcion: "Ruta corta para memorandos entre dependencias: atención por el área destinataria y cierre.",
    aplicaA: "INTERNA",
    pasos: [
      {
        clave: "atencion",
        nombre: "Atención del memorando",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 5,
        instrucciones: "Atienda lo solicitado en el memorando y deje constancia de la gestión.",
        transiciones: [{ etiqueta: "Atendido", hacia: "cierre" }],
      },
      { clave: "cierre", nombre: "Cierre", tipo: "FIN", asignacion: "DEPENDENCIA_COMUNICACION" },
    ],
  },
  {
    nombre: "Ruta básica de gestión documental",
    descripcion:
      "Flujo genérico de tres pasos aplicable a cualquier tipo de comunicación: estudio, actuación y verificación con archivo. La verificación puede reabrir la actuación.",
    aplicaA: null,
    pasos: [
      {
        clave: "estudio",
        nombre: "Asignación y estudio",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 5,
        instrucciones: "Estudie el asunto y determine la actuación que corresponde.",
        transiciones: [{ etiqueta: "Continuar", hacia: "actuacion" }],
      },
      {
        clave: "actuacion",
        nombre: "Respuesta o actuación",
        tipo: "TAREA",
        asignacion: "RESPONSABLE_PASO_ANTERIOR",
        slaDiasHabiles: 5,
        instrucciones: "Ejecute la actuación (respuesta, concepto, trámite interno) y adjunte los soportes.",
        transiciones: [{ etiqueta: "Continuar", hacia: "verificacion" }],
      },
      {
        clave: "verificacion",
        nombre: "Verificación y archivo",
        tipo: "REVISION",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 2,
        instrucciones: "Verifique que la actuación esté completa y archívela, o reábrala si falta algo.",
        transiciones: [
          { etiqueta: "Archivar", hacia: "cierre" },
          { etiqueta: "Reabrir", hacia: "actuacion" },
        ],
      },
      { clave: "cierre", nombre: "Cierre", tipo: "FIN", asignacion: "DEPENDENCIA_COMUNICACION" },
    ],
  },
  {
    nombre: "Derecho de petición con revisión jurídica",
    descripcion:
      "Petición recibida que requiere concepto jurídico: estudio en la dependencia, proyección, revisión del profesional en derecho, aprobación de la dependencia y radicación de la respuesta (Ley 1755 de 2015).",
    aplicaA: "RECIBIDA",
    pasos: [
      {
        clave: "estudio",
        nombre: "Estudio de la petición",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 2,
        instrucciones: "Verifique que la petición esté completa y sea de competencia de la CDMB; si falta información, solicítela al peticionario.",
        transiciones: [{ etiqueta: "Proyectar respuesta", hacia: "proyeccion" }],
      },
      {
        clave: "proyeccion",
        nombre: "Proyección de la respuesta",
        tipo: "TAREA",
        asignacion: "RESPONSABLE_PASO_ANTERIOR",
        slaDiasHabiles: 6,
        instrucciones: "Redacte el proyecto de respuesta de fondo con sus soportes.",
        transiciones: [{ etiqueta: "Enviar a revisión jurídica", hacia: "juridica" }],
      },
      {
        clave: "juridica",
        nombre: "Revisión jurídica",
        tipo: "REVISION",
        asignacion: "CARGO",
        cargoClave: "Profesional en Derecho / Jurídico",
        slaDiasHabiles: 3,
        instrucciones: "Revise el fundamento normativo y la procedencia de la respuesta.",
        transiciones: [
          { etiqueta: "Aprobar", hacia: "aprobacion" },
          { etiqueta: "Devolver con observaciones", hacia: "proyeccion" },
        ],
      },
      {
        clave: "aprobacion",
        nombre: "Aprobación de la dependencia",
        tipo: "REVISION",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 2,
        instrucciones: "Apruebe la respuesta para su radicación o devuélvala con observaciones.",
        transiciones: [
          { etiqueta: "Aprobar para radicación", hacia: "radicacion" },
          { etiqueta: "Devolver", hacia: "proyeccion" },
        ],
      },
      {
        clave: "radicacion",
        nombre: "Radicación de la respuesta",
        tipo: "TAREA",
        asignacion: "RADICADOR",
        slaDiasHabiles: 1,
        instrucciones: "Radique la respuesta como oficio de salida enlazado a esta comunicación (Responde a).",
        transiciones: [{ etiqueta: "Respuesta radicada", hacia: "cierre" }],
      },
      { clave: "cierre", nombre: "Cierre", tipo: "FIN", asignacion: "DEPENDENCIA_COMUNICACION" },
    ],
  },
  {
    nombre: "Solicitud de acceso a información pública",
    descripcion:
      "Solicitud de copias o de información (Ley 1712 de 2014): verificación de la clasificación, entrega de la información o respuesta motivada si es clasificada o reservada.",
    aplicaA: "RECIBIDA",
    pasos: [
      {
        clave: "verificacion",
        nombre: "Verificación de la información",
        tipo: "DECISION",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 2,
        instrucciones: "Determine si la información solicitada es pública o si es clasificada o reservada según el índice de información.",
        transiciones: [
          { etiqueta: "Información pública", hacia: "entrega" },
          { etiqueta: "Clasificada o reservada", hacia: "motivada" },
        ],
      },
      {
        clave: "entrega",
        nombre: "Preparación de la entrega",
        tipo: "TAREA",
        asignacion: "RESPONSABLE_PASO_ANTERIOR",
        slaDiasHabiles: 6,
        instrucciones: "Reúna la información o las copias y prepare la respuesta de entrega.",
        transiciones: [{ etiqueta: "Lista para radicar", hacia: "radicacion" }],
      },
      {
        clave: "motivada",
        nombre: "Respuesta motivada",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Profesional en Derecho / Jurídico",
        slaDiasHabiles: 5,
        instrucciones: "Proyecte la respuesta que niega el acceso, indicando la norma que lo fundamenta y los recursos procedentes.",
        transiciones: [{ etiqueta: "Lista para radicar", hacia: "radicacion" }],
      },
      {
        clave: "radicacion",
        nombre: "Radicación de la respuesta",
        tipo: "TAREA",
        asignacion: "RADICADOR",
        slaDiasHabiles: 1,
        instrucciones: "Radique la respuesta como oficio de salida enlazado a esta comunicación.",
        transiciones: [{ etiqueta: "Respuesta radicada", hacia: "cierre" }],
      },
      { clave: "cierre", nombre: "Cierre", tipo: "FIN", asignacion: "DEPENDENCIA_COMUNICACION" },
    ],
  },
  {
    nombre: "Traslado por competencia",
    descripcion:
      "Análisis de competencia de una comunicación recibida y, si no corresponde a la CDMB, oficio de traslado a la autoridad competente con copia al peticionario (art. 21, Ley 1755 de 2015).",
    aplicaA: "RECIBIDA",
    pasos: [
      {
        clave: "analisis",
        nombre: "Análisis de competencia",
        tipo: "DECISION",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 2,
        instrucciones: "Determine si el asunto es competencia de la CDMB.",
        transiciones: [
          { etiqueta: "Es competencia de la CDMB", hacia: "cierre" },
          { etiqueta: "Trasladar", hacia: "oficio" },
        ],
      },
      {
        clave: "oficio",
        nombre: "Oficio de traslado",
        tipo: "TAREA",
        asignacion: "RESPONSABLE_PASO_ANTERIOR",
        slaDiasHabiles: 3,
        instrucciones: "Proyecte el oficio de traslado a la autoridad competente e informe al peticionario.",
        transiciones: [{ etiqueta: "Listo para radicar", hacia: "radicacion" }],
      },
      {
        clave: "radicacion",
        nombre: "Radicación del traslado",
        tipo: "TAREA",
        asignacion: "RADICADOR",
        slaDiasHabiles: 1,
        instrucciones: "Radique el oficio de traslado y su copia al peticionario.",
        transiciones: [{ etiqueta: "Traslado radicado", hacia: "cierre" }],
      },
      { clave: "cierre", nombre: "Cierre", tipo: "FIN", asignacion: "DEPENDENCIA_COMUNICACION" },
    ],
  },
  {
    nombre: "Requerimiento de ente de control",
    descripcion:
      "Requerimiento de Contraloría, Procuraduría u otro ente de control: consolidación por una persona responsable, revisión jurídica, visto bueno de la Dirección y radicación de la respuesta.",
    aplicaA: "RECIBIDA",
    pasos: [
      {
        clave: "designacion",
        nombre: "Designación del responsable",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 1,
        instrucciones: "Elija a la persona que consolidará la respuesta y continúe.",
        transiciones: [{ etiqueta: "Asignar consolidación", hacia: "consolidacion" }],
      },
      {
        clave: "consolidacion",
        nombre: "Consolidación de la respuesta",
        tipo: "TAREA",
        asignacion: "MANUAL",
        slaDiasHabiles: 4,
        instrucciones: "Reúna la información de las dependencias involucradas y proyecte la respuesta.",
        transiciones: [{ etiqueta: "Enviar a revisión jurídica", hacia: "juridica" }],
      },
      {
        clave: "juridica",
        nombre: "Revisión jurídica",
        tipo: "REVISION",
        asignacion: "CARGO",
        cargoClave: "Profesional en Derecho / Jurídico",
        slaDiasHabiles: 2,
        transiciones: [
          { etiqueta: "Aprobar", hacia: "direccion" },
          { etiqueta: "Devolver con observaciones", hacia: "consolidacion" },
        ],
      },
      {
        clave: "direccion",
        nombre: "Visto bueno de la Dirección",
        tipo: "REVISION",
        asignacion: "CARGO",
        cargoClave: "Director(a) General",
        slaDiasHabiles: 2,
        transiciones: [
          { etiqueta: "Aprobar para radicación", hacia: "radicacion" },
          { etiqueta: "Devolver", hacia: "consolidacion" },
        ],
      },
      {
        clave: "radicacion",
        nombre: "Radicación de la respuesta",
        tipo: "TAREA",
        asignacion: "RADICADOR",
        slaDiasHabiles: 1,
        transiciones: [{ etiqueta: "Respuesta radicada", hacia: "cierre" }],
      },
      { clave: "cierre", nombre: "Cierre", tipo: "FIN", asignacion: "DEPENDENCIA_COMUNICACION" },
    ],
  },
  {
    nombre: "Oficio de salida con revisión jurídica y firma",
    descripcion:
      "Oficio que requiere concepto jurídico antes de la firma: redacción, revisión del profesional en derecho, firma electrónica y despacho.",
    aplicaA: "ENVIADA",
    pasos: [
      {
        clave: "redaccion",
        nombre: "Redacción del oficio",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 3,
        transiciones: [{ etiqueta: "Enviar a revisión jurídica", hacia: "juridica" }],
      },
      {
        clave: "juridica",
        nombre: "Revisión jurídica",
        tipo: "REVISION",
        asignacion: "CARGO",
        cargoClave: "Profesional en Derecho / Jurídico",
        slaDiasHabiles: 2,
        transiciones: [
          { etiqueta: "Aprobar para firma", hacia: "firma" },
          { etiqueta: "Devolver con observaciones", hacia: "redaccion" },
        ],
      },
      {
        clave: "firma",
        nombre: "Firma electrónica",
        tipo: "FIRMA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 3,
        instrucciones: "Asigne los firmantes. El flujo avanza solo cuando todos firman; si alguien rechaza, vuelve a redacción.",
        transiciones: [
          { etiqueta: "Firmado", hacia: "despacho" },
          { etiqueta: "Rechazado", hacia: "redaccion" },
        ],
      },
      { clave: "despacho", nombre: "Despacho y archivo", tipo: "FIN", asignacion: "DEPENDENCIA_COMUNICACION" },
    ],
  },
  {
    nombre: "Notificación de acto administrativo",
    descripcion:
      "Comunicación de salida que notifica un acto administrativo: preparación, firma electrónica, envío y, si la notificación personal no es posible, notificación por aviso (arts. 67 a 69, Ley 1437 de 2011).",
    aplicaA: "ENVIADA",
    pasos: [
      {
        clave: "preparacion",
        nombre: "Preparación de la notificación",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Servidor(a) de Notificaciones",
        slaDiasHabiles: 2,
        instrucciones: "Prepare la citación o la comunicación con copia íntegra del acto y los recursos procedentes.",
        transiciones: [{ etiqueta: "Enviar a firma", hacia: "firma" }],
      },
      {
        clave: "firma",
        nombre: "Firma electrónica",
        tipo: "FIRMA",
        asignacion: "CARGO",
        cargoClave: "Servidor(a) de Notificaciones",
        slaDiasHabiles: 2,
        transiciones: [
          { etiqueta: "Firmado", hacia: "envio" },
          { etiqueta: "Rechazado", hacia: "preparacion" },
        ],
      },
      {
        clave: "envio",
        nombre: "Envío y constancia",
        tipo: "DECISION",
        asignacion: "CARGO",
        cargoClave: "Servidor(a) de Notificaciones",
        slaDiasHabiles: 5,
        instrucciones: "Envíe la notificación y registre la constancia de entrega.",
        transiciones: [
          { etiqueta: "Notificado", hacia: "cierre" },
          { etiqueta: "No fue posible notificar", hacia: "aviso" },
        ],
      },
      {
        clave: "aviso",
        nombre: "Notificación por aviso",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Servidor(a) de Notificaciones",
        slaDiasHabiles: 5,
        instrucciones: "Envíe el aviso con copia del acto o publíquelo en la página web y en lugar visible por cinco días.",
        transiciones: [{ etiqueta: "Aviso surtido", hacia: "cierre" }],
      },
      { clave: "cierre", nombre: "Notificación surtida", tipo: "FIN", asignacion: "CARGO", cargoClave: "Servidor(a) de Notificaciones" },
    ],
  },
  {
    nombre: "Memorando con respuesta y firma",
    descripcion: "Memorando que requiere respuesta escrita del área destinataria: proyección, firma electrónica de la respuesta y cierre.",
    aplicaA: "INTERNA",
    pasos: [
      {
        clave: "proyeccion",
        nombre: "Proyección de la respuesta",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 5,
        transiciones: [{ etiqueta: "Enviar a firma", hacia: "firma" }],
      },
      {
        clave: "firma",
        nombre: "Firma electrónica",
        tipo: "FIRMA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 2,
        transiciones: [
          { etiqueta: "Firmado", hacia: "cierre" },
          { etiqueta: "Rechazado", hacia: "proyeccion" },
        ],
      },
      { clave: "cierre", nombre: "Cierre", tipo: "FIN", asignacion: "DEPENDENCIA_COMUNICACION" },
    ],
  },
  {
    nombre: "Transferencia documental primaria",
    descripcion: "La dependencia prepara el expediente para transferirlo al archivo central; el archivo central lo revisa y lo acepta o lo devuelve con observaciones.",
    aplicaA: null,
    ambito: "EXPEDIENTE",
    pasos: [
      {
        clave: "preparacion",
        nombre: "Preparación del expediente",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 10,
        instrucciones: "Verifique la foliación, el índice y la clasificación TRD antes de entregar.",
        transiciones: [{ etiqueta: "Enviar al archivo central", hacia: "revision" }],
      },
      {
        clave: "revision",
        nombre: "Revisión del archivo central",
        tipo: "REVISION",
        asignacion: "MANUAL",
        slaDiasHabiles: 5,
        transiciones: [
          { etiqueta: "Aceptar la transferencia", hacia: "cierre" },
          { etiqueta: "Devolver con observaciones", hacia: "preparacion" },
        ],
      },
      { clave: "cierre", nombre: "Transferencia recibida", tipo: "FIN", asignacion: "DEPENDENCIA_COMUNICACION" },
    ],
  },
  {
    nombre: "Revisión de estudios previos",
    descripcion: "La dependencia solicitante elabora los estudios previos, el personal de contratación hace la revisión jurídica y quien se designe da el visto bueno final.",
    aplicaA: null,
    ambito: "CONTRATO",
    pasos: [
      {
        clave: "elaboracion",
        nombre: "Elaboración de estudios previos",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 5,
        transiciones: [{ etiqueta: "Enviar a revisión jurídica", hacia: "juridica" }],
      },
      {
        clave: "juridica",
        nombre: "Revisión jurídica",
        tipo: "REVISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 3,
        transiciones: [
          { etiqueta: "Aprobar", hacia: "visto_bueno" },
          { etiqueta: "Devolver para ajustes", hacia: "elaboracion" },
        ],
      },
      {
        clave: "visto_bueno",
        nombre: "Visto bueno final",
        tipo: "REVISION",
        asignacion: "MANUAL",
        slaDiasHabiles: 2,
        transiciones: [
          { etiqueta: "Aprobar", hacia: "cierre" },
          { etiqueta: "Devolver a revisión jurídica", hacia: "juridica" },
        ],
      },
      { clave: "cierre", nombre: "Estudios previos aprobados", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
  {
    nombre: "Aprobación del informe de supervisión",
    descripcion: "El supervisor revisa el informe y sus soportes; el personal de contratación verifica que esté completo para el trámite de pago.",
    aplicaA: null,
    ambito: "CONTRATO",
    pasos: [
      {
        clave: "supervisor",
        nombre: "Revisión del supervisor",
        tipo: "REVISION",
        asignacion: "SUPERVISOR",
        slaDiasHabiles: 3,
        transiciones: [{ etiqueta: "Aprobar el informe", hacia: "verificacion" }],
      },
      {
        clave: "verificacion",
        nombre: "Verificación de contratación",
        tipo: "REVISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 2,
        transiciones: [
          { etiqueta: "Completo para pago", hacia: "cierre" },
          { etiqueta: "Devolver al supervisor", hacia: "supervisor" },
        ],
      },
      { clave: "cierre", nombre: "Informe aprobado", tipo: "FIN", asignacion: "SUPERVISOR" },
    ],
  },
  {
    nombre: "Liquidación del contrato",
    descripcion: "El supervisor proyecta el acta de liquidación y el personal de contratación la revisa antes de suscribirla.",
    aplicaA: null,
    ambito: "CONTRATO",
    pasos: [
      {
        clave: "proyeccion",
        nombre: "Proyección del acta de liquidación",
        tipo: "TAREA",
        asignacion: "SUPERVISOR",
        slaDiasHabiles: 10,
        transiciones: [{ etiqueta: "Enviar a revisión", hacia: "revision" }],
      },
      {
        clave: "revision",
        nombre: "Revisión jurídica del acta",
        tipo: "REVISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 5,
        transiciones: [
          { etiqueta: "Aprobar", hacia: "cierre" },
          { etiqueta: "Devolver para ajustes", hacia: "proyeccion" },
        ],
      },
      { clave: "cierre", nombre: "Acta lista para suscribir", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
  {
    nombre: "Revisión de acto administrativo",
    descripcion: "El personal asignado proyecta el auto o la resolución, quien se designe hace la revisión jurídica y luego el visto bueno para firma.",
    aplicaA: null,
    ambito: "TRAMITE",
    pasos: [
      {
        clave: "proyeccion",
        nombre: "Proyección del acto administrativo",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 5,
        transiciones: [{ etiqueta: "Enviar a revisión jurídica", hacia: "juridica" }],
      },
      {
        clave: "juridica",
        nombre: "Revisión jurídica",
        tipo: "REVISION",
        asignacion: "MANUAL",
        slaDiasHabiles: 3,
        transiciones: [
          { etiqueta: "Aprobar", hacia: "visto_bueno" },
          { etiqueta: "Devolver para ajustes", hacia: "proyeccion" },
        ],
      },
      {
        clave: "visto_bueno",
        nombre: "Visto bueno para firma",
        tipo: "REVISION",
        asignacion: "MANUAL",
        slaDiasHabiles: 2,
        transiciones: [
          { etiqueta: "Aprobar para firma", hacia: "cierre" },
          { etiqueta: "Devolver a revisión jurídica", hacia: "juridica" },
        ],
      },
      { clave: "cierre", nombre: "Acto listo para firma", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
  {
    nombre: "Revisión de información adicional",
    descripcion: "El personal asignado revisa la información aportada por el solicitante; si está incompleta se prepara un nuevo requerimiento.",
    aplicaA: null,
    ambito: "TRAMITE",
    pasos: [
      {
        clave: "revision",
        nombre: "Revisión de la información aportada",
        tipo: "DECISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 5,
        transiciones: [
          { etiqueta: "Información completa", hacia: "cierre" },
          { etiqueta: "Información incompleta", hacia: "requerimiento" },
        ],
      },
      {
        clave: "requerimiento",
        nombre: "Nuevo requerimiento al solicitante",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 3,
        transiciones: [{ etiqueta: "Respuesta recibida", hacia: "revision" }],
      },
      { clave: "cierre", nombre: "Información completa", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
];

export type ProblemaFlujo = { paso?: string; mensaje: string };

export function validarEstructuraFlujo(pasos: {
  id: string;
  nombre: string;
  tipo: string;
  orden: number;
  transiciones: { haciaPasoId: string; etiqueta?: string }[];
  asignacion?: string;
  dependenciaId?: string | null;
  cargoClave?: string | null;
}[]): ProblemaFlujo[] {
  const problemas: ProblemaFlujo[] = [];
  if (pasos.length === 0) return [{ mensaje: "El flujo no tiene pasos." }];

  const inicial = [...pasos].sort((a, b) => a.orden - b.orden)[0]!;
  const finales = pasos.filter((p) => p.tipo === "FIN");
  if (finales.length === 0) problemas.push({ mensaje: "El flujo no tiene ningún paso de tipo «Fin»." });

  for (const p of pasos) {
    if (p.tipo === "FIN") {
      if (p.transiciones.length > 0) problemas.push({ paso: p.nombre, mensaje: "Un paso «Fin» no debería tener salidas." });
      continue;
    }
    if (p.transiciones.length === 0) problemas.push({ paso: p.nombre, mensaje: "El paso no tiene ninguna salida (transición)." });
    if (p.asignacion === "DEPENDENCIA_FIJA" && !p.dependenciaId) problemas.push({ paso: p.nombre, mensaje: "El responsable es una dependencia fija, pero no se eligió cuál." });
    if (p.asignacion === "CARGO" && !p.cargoClave) problemas.push({ paso: p.nombre, mensaje: "El responsable es un cargo, pero no se eligió cuál." });
    if (p.tipo === "FIRMA" && p.transiciones.length > 1) {
      const etiquetas = p.transiciones.map((t) => t.etiqueta ?? "");
      const rechazo = etiquetas.filter((e) => /rechaz|devolv|no aprueb|corregir/i.test(e)).length;
      if (rechazo !== 1 || etiquetas.length - rechazo < 1) {
        problemas.push({ paso: p.nombre, mensaje: "Un paso de firma con varias salidas necesita una sola salida para el rechazo (p. ej. «Rechazado» o «Devolver») y otra para cuando queda firmado." });
      }
    }
  }

  const porId = new Map(pasos.map((p) => [p.id, p]));
  const visto = new Set<string>();
  const cola = [inicial.id];
  while (cola.length) {
    const id = cola.pop()!;
    if (visto.has(id)) continue;
    visto.add(id);
    for (const t of porId.get(id)?.transiciones ?? []) cola.push(t.haciaPasoId);
  }
  const alcanzaFin = finales.some((f) => visto.has(f.id));
  if (finales.length > 0 && !alcanzaFin) {
    problemas.push({ mensaje: "Desde el paso inicial no se llega a ningún paso «Fin»." });
  }
  for (const p of pasos) {
    if (!visto.has(p.id)) problemas.push({ paso: p.nombre, mensaje: "El paso no es alcanzable desde el paso inicial." });
  }

  return problemas;
}
