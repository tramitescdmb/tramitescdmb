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
  dependencia?: string;
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
    nombre: "Contratación directa de prestación de servicios",
    descripcion:
      "Desde la solicitud de la dependencia hasta el acta de inicio: estudios previos, CDP, revisión jurídica e idoneidad, suscripción en SECOP II, garantías, registro presupuestal y designación del supervisor.",
    aplicaA: null,
    ambito: "CONTRATO",
    pasos: [
      {
        clave: "solicitud",
        nombre: "Solicitud y estudios previos",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 5,
        instrucciones:
          "Cargue la solicitud de personal idóneo (A-BS-FO86), los estudios y documentos previos (A-BS-FO75), el certificado del Plan Anual de Adquisiciones (A-BS-FO69) y la hoja de vida SIGEP del futuro contratista.",
        transiciones: [{ etiqueta: "Solicitar CDP", hacia: "cdp" }],
      },
      {
        clave: "cdp",
        nombre: "Expedición del CDP",
        tipo: "DECISION",
        asignacion: "DEPENDENCIA_FIJA",
        dependencia: "Subdirección Administrativa y Financiera - SAF - Grupo Gestión Presupuestal y Eficiencia del Gasto Público",
        slaDiasHabiles: 2,
        instrucciones: "Verifique el rubro y la apropiación disponible y expida el Certificado de Disponibilidad Presupuestal.",
        transiciones: [
          { etiqueta: "CDP expedido", hacia: "juridica" },
          { etiqueta: "Devolver: sin disponibilidad o rubro errado", hacia: "solicitud" },
        ],
      },
      {
        clave: "juridica",
        nombre: "Revisión jurídica y de idoneidad",
        tipo: "REVISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 3,
        instrucciones:
          "Verifique la idoneidad y experiencia frente al objeto, el acta de justificación de la contratación directa (A-BS-FO94) y la invitación a único oferente (A-BS-FO108). Consulte antecedentes fiscales, disciplinarios, judiciales y de medidas correctivas.",
        transiciones: [
          { etiqueta: "Aprobar", hacia: "contrato" },
          { etiqueta: "Devolver para ajustes", hacia: "solicitud" },
        ],
      },
      {
        clave: "contrato",
        nombre: "Elaboración y suscripción en SECOP II",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 2,
        instrucciones: "Elabore la minuta con el anexo complementario (A-BS-FO100), publíquela en SECOP II y gestione la aceptación del contratista y la firma del ordenador del gasto.",
        transiciones: [{ etiqueta: "Contrato suscrito", hacia: "garantias" }],
      },
      {
        clave: "garantias",
        nombre: "Aprobación de garantías",
        tipo: "REVISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 2,
        instrucciones: "Revise amparos, vigencias y valores asegurados frente al contrato y deje el acta de aprobación de garantías (A-BS-FO62). Si el contrato no exige garantía, déjelo anotado.",
        transiciones: [
          { etiqueta: "Garantías aprobadas", hacia: "rp" },
          { etiqueta: "Devolver: póliza con inconsistencias", hacia: "contrato" },
        ],
      },
      {
        clave: "rp",
        nombre: "Registro presupuestal",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_FIJA",
        dependencia: "Subdirección Administrativa y Financiera - SAF - Grupo Gestión Presupuestal y Eficiencia del Gasto Público",
        slaDiasHabiles: 1,
        instrucciones: "Expida el Registro Presupuestal (RP) que perfecciona el compromiso y cárguelo al expediente.",
        transiciones: [{ etiqueta: "RP expedido", hacia: "inicio" }],
      },
      {
        clave: "inicio",
        nombre: "Designación de supervisor y acta de inicio",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 3,
        instrucciones: "Designe al supervisor (A-BS-FO74) y suscriba con el contratista el acta de inicio de la ejecución (A-BS-FO124). Verifique la afiliación a la ARL antes del inicio.",
        transiciones: [{ etiqueta: "Ejecución iniciada", hacia: "cierre" }],
      },
      { clave: "cierre", nombre: "Contrato en ejecución", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
  {
    nombre: "Proceso de mínima cuantía",
    descripcion:
      "Invitación pública en SECOP II, evaluación de la oferta de menor precio, respuesta a observaciones y aceptación de la oferta o declaratoria de desierto (Decreto 1082 de 2015).",
    aplicaA: null,
    ambito: "CONTRATO",
    pasos: [
      {
        clave: "estudios",
        nombre: "Estudios previos y CDP",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 5,
        instrucciones: "Cargue el requerimiento técnico (A-BS-FO85), los estudios previos (A-BS-FO75), el estudio de mercado (A-BS-FO77) y el CDP.",
        transiciones: [{ etiqueta: "Enviar a contratación", hacia: "invitacion" }],
      },
      {
        clave: "invitacion",
        nombre: "Invitación pública en SECOP II",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 3,
        instrucciones: "Publique el aviso de convocatoria (A-BS-FO70) y la invitación. El plazo para presentar ofertas no puede ser inferior a un día hábil.",
        transiciones: [{ etiqueta: "Cierre del plazo de ofertas", hacia: "evaluacion" }],
      },
      {
        clave: "evaluacion",
        nombre: "Evaluación de la oferta de menor precio",
        tipo: "DECISION",
        asignacion: "MANUAL",
        slaDiasHabiles: 2,
        instrucciones:
          "Verifique los requisitos habilitantes de la oferta con el menor precio; si no cumple, continúe con la siguiente. Deje el acta de evaluación de cumplimiento de requisitos (A-BS-FO91) y publíquela por un día hábil.",
        transiciones: [
          { etiqueta: "Hay oferta habilitada", hacia: "aceptacion" },
          { etiqueta: "Ninguna oferta habilitada", hacia: "desierto" },
        ],
      },
      {
        clave: "aceptacion",
        nombre: "Respuesta a observaciones y aceptación de la oferta",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 2,
        instrucciones: "Responda las observaciones (A-BS-FO89) y publique la comunicación de aceptación de la oferta (A-BS-FO61), que junto con la oferta constituye el contrato.",
        transiciones: [{ etiqueta: "Oferta aceptada", hacia: "garantias" }],
      },
      {
        clave: "garantias",
        nombre: "Garantías y registro presupuestal",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 3,
        instrucciones: "Apruebe las garantías (A-BS-FO62) y gestione el registro presupuestal antes del acta de inicio.",
        transiciones: [{ etiqueta: "Contrato perfeccionado", hacia: "cierre" }],
      },
      {
        clave: "desierto",
        nombre: "Declaratoria de desierto",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 2,
        instrucciones: "Proyecte el acta administrativa de declaratoria de desierto (A-BS-FO107) con sus motivos y publíquela en SECOP II.",
        transiciones: [{ etiqueta: "Desierto declarado", hacia: "fin_desierto" }],
      },
      { clave: "cierre", nombre: "Contrato perfeccionado", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
      { clave: "fin_desierto", nombre: "Proceso declarado desierto", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
  {
    nombre: "Revisión de estudios previos",
    descripcion:
      "Para procesos competitivos (licitación, selección abreviada, concurso de méritos): la dependencia estructura el requerimiento y el estudio del sector, contratación hace la revisión jurídica y el ordenador del gasto da el visto bueno.",
    aplicaA: null,
    ambito: "CONTRATO",
    pasos: [
      {
        clave: "elaboracion",
        nombre: "Elaboración de estudios previos",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 10,
        instrucciones: "Cargue el requerimiento técnico (A-BS-FO85), el estudio del sector (A-BS-FO76), los estudios previos (A-BS-FO75), el análisis de riesgos y el CDP.",
        transiciones: [{ etiqueta: "Enviar a revisión jurídica", hacia: "juridica" }],
      },
      {
        clave: "juridica",
        nombre: "Revisión jurídica",
        tipo: "REVISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 5,
        instrucciones: "Verifique la modalidad, los requisitos habilitantes, los factores de evaluación y el aviso de no limitación a Mipymes (A-BS-FO102) cuando aplique.",
        transiciones: [
          { etiqueta: "Aprobar", hacia: "visto_bueno" },
          { etiqueta: "Devolver para ajustes", hacia: "elaboracion" },
        ],
      },
      {
        clave: "visto_bueno",
        nombre: "Visto bueno del ordenador del gasto",
        tipo: "REVISION",
        asignacion: "MANUAL",
        slaDiasHabiles: 3,
        transiciones: [
          { etiqueta: "Aprobar", hacia: "cierre" },
          { etiqueta: "Devolver a revisión jurídica", hacia: "juridica" },
        ],
      },
      { clave: "cierre", nombre: "Estudios previos aprobados", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
  {
    nombre: "Informe de supervisión y trámite de pago",
    descripcion: "El supervisor revisa el informe y sus soportes, contratación verifica que esté completo y tesorería tramita el pago.",
    aplicaA: null,
    ambito: "CONTRATO",
    pasos: [
      {
        clave: "supervisor",
        nombre: "Revisión del supervisor",
        tipo: "REVISION",
        asignacion: "SUPERVISOR",
        slaDiasHabiles: 3,
        instrucciones:
          "Verifique el cumplimiento de las obligaciones del periodo en el informe de supervisión (A-BS-FO116) o el formato único de informe de cumplimiento (A-BS-FO132) y el pago de aportes a seguridad social (PILA).",
        transiciones: [{ etiqueta: "Aprobar el informe", hacia: "verificacion" }],
      },
      {
        clave: "verificacion",
        nombre: "Verificación de contratación",
        tipo: "REVISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 2,
        instrucciones: "Confirme que el informe, el acta de recibo parcial (A-BS-FO127) cuando aplique y la planilla PILA correspondan al periodo y al valor a pagar.",
        transiciones: [
          { etiqueta: "Completo para pago", hacia: "pago" },
          { etiqueta: "Devolver al supervisor", hacia: "supervisor" },
        ],
      },
      {
        clave: "pago",
        nombre: "Obligación y pago",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_FIJA",
        dependencia: "Subdirección Administrativa y Financiera - SAF - Grupo Tesorería y Cartera",
        slaDiasHabiles: 5,
        instrucciones: "Registre la obligación, aplique las deducciones y retenciones de ley y efectúe el giro.",
        transiciones: [
          { etiqueta: "Pago realizado", hacia: "cierre" },
          { etiqueta: "Devolver a contratación", hacia: "verificacion" },
        ],
      },
      { clave: "cierre", nombre: "Periodo pagado", tipo: "FIN", asignacion: "SUPERVISOR" },
    ],
  },
  {
    nombre: "Modificación contractual (adición, prórroga u otrosí)",
    descripcion:
      "El supervisor justifica la modificación antes del vencimiento del plazo, contratación la revisa, presupuesto expide el CDP si hay adición y se suscribe el documento con el ajuste de garantías.",
    aplicaA: null,
    ambito: "CONTRATO",
    pasos: [
      {
        clave: "solicitud",
        nombre: "Solicitud justificada del supervisor",
        tipo: "TAREA",
        asignacion: "SUPERVISOR",
        slaDiasHabiles: 3,
        instrucciones:
          "Justifique técnica y financieramente la necesidad con el acta de concertación que corresponda: adición de plazo o valor (A-BS-FO120 / A-BS-FO128), prórroga (A-BS-FO123) o modificación o aclaración (A-BS-FO122). Debe tramitarse antes de que venza el plazo del contrato.",
        transiciones: [{ etiqueta: "Enviar a contratación", hacia: "juridica" }],
      },
      {
        clave: "juridica",
        nombre: "Revisión jurídica",
        tipo: "DECISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 3,
        instrucciones: "Verifique la procedencia y que las adiciones no superen el 50 % del valor inicial expresado en SMMLV (art. 40 de la Ley 80 de 1993).",
        transiciones: [
          { etiqueta: "Requiere recursos: adición", hacia: "cdp" },
          { etiqueta: "Sin recursos: prórroga u otrosí", hacia: "documento" },
          { etiqueta: "Devolver al supervisor", hacia: "solicitud" },
        ],
      },
      {
        clave: "cdp",
        nombre: "CDP de la adición",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_FIJA",
        dependencia: "Subdirección Administrativa y Financiera - SAF - Grupo Gestión Presupuestal y Eficiencia del Gasto Público",
        slaDiasHabiles: 2,
        transiciones: [{ etiqueta: "CDP expedido", hacia: "documento" }],
      },
      {
        clave: "documento",
        nombre: "Suscripción del documento modificatorio",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 3,
        instrucciones: "Elabore el documento, gestione las firmas y publíquelo en SECOP II. Si hubo adición, solicite el registro presupuestal de la adición.",
        transiciones: [{ etiqueta: "Documento suscrito", hacia: "garantias" }],
      },
      {
        clave: "garantias",
        nombre: "Ajuste de garantías",
        tipo: "REVISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 3,
        instrucciones: "Apruebe la modificación de la póliza para que cubra el nuevo plazo o valor.",
        transiciones: [{ etiqueta: "Garantías ajustadas", hacia: "cierre" }],
      },
      { clave: "cierre", nombre: "Modificación perfeccionada", tipo: "FIN", asignacion: "SUPERVISOR" },
    ],
  },
  {
    nombre: "Suspensión y reinicio del contrato",
    descripcion: "El supervisor solicita la suspensión por circunstancias que impiden la ejecución, contratación la revisa y, superada la causa, se suscribe el reinicio.",
    aplicaA: null,
    ambito: "CONTRATO",
    pasos: [
      {
        clave: "solicitud",
        nombre: "Solicitud de suspensión",
        tipo: "TAREA",
        asignacion: "SUPERVISOR",
        slaDiasHabiles: 2,
        instrucciones: "Describa la causa (fuerza mayor, caso fortuito o interés público), el plazo estimado de la suspensión y el estado de ejecución.",
        transiciones: [{ etiqueta: "Enviar a contratación", hacia: "juridica" }],
      },
      {
        clave: "juridica",
        nombre: "Revisión jurídica",
        tipo: "REVISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 2,
        transiciones: [
          { etiqueta: "Procede la suspensión", hacia: "acta" },
          { etiqueta: "Devolver al supervisor", hacia: "solicitud" },
        ],
      },
      {
        clave: "acta",
        nombre: "Acta de suspensión",
        tipo: "TAREA",
        asignacion: "SUPERVISOR",
        slaDiasHabiles: 2,
        instrucciones: "Suscriba el acta de suspensión (A-BS-FO130) con el contratista y solicite la ampliación de la vigencia de las garantías.",
        transiciones: [{ etiqueta: "Contrato suspendido", hacia: "reinicio" }],
      },
      {
        clave: "reinicio",
        nombre: "Reinicio de la ejecución",
        tipo: "TAREA",
        asignacion: "SUPERVISOR",
        instrucciones: "Superada la causa, suscriba el acta de reinicio (A-BS-FO130) y actualice el plazo de terminación.",
        transiciones: [{ etiqueta: "Ejecución reanudada", hacia: "cierre" }],
      },
      { clave: "cierre", nombre: "Contrato reanudado", tipo: "FIN", asignacion: "SUPERVISOR" },
    ],
  },
  {
    nombre: "Presunto incumplimiento contractual",
    descripcion:
      "Procedimiento del artículo 86 de la Ley 1474 de 2011: informe del supervisor, citación al contratista y al garante, audiencia de descargos y comunicación de la decisión.",
    aplicaA: null,
    ambito: "CONTRATO",
    pasos: [
      {
        clave: "informe",
        nombre: "Informe de presunto incumplimiento",
        tipo: "TAREA",
        asignacion: "SUPERVISOR",
        slaDiasHabiles: 3,
        instrucciones: "Elabore el informe (A-BS-FO115) con los hechos, las obligaciones incumplidas, las pruebas y la tasación de la multa o perjuicio.",
        transiciones: [{ etiqueta: "Enviar a contratación", hacia: "citacion" }],
      },
      {
        clave: "citacion",
        nombre: "Estudio jurídico y citación",
        tipo: "DECISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 5,
        instrucciones: "Si hay mérito, cite al contratista y a la aseguradora a audiencia indicando hechos, normas o cláusulas posiblemente violadas y consecuencias.",
        transiciones: [
          { etiqueta: "Citar a audiencia", hacia: "audiencia" },
          { etiqueta: "No hay mérito", hacia: "archivo" },
          { etiqueta: "Devolver al supervisor", hacia: "informe" },
        ],
      },
      {
        clave: "audiencia",
        nombre: "Audiencia de descargos y decisión",
        tipo: "DECISION",
        asignacion: "MANUAL",
        slaDiasHabiles: 10,
        instrucciones: "El ordenador del gasto o su delegado preside la audiencia; deje el acta (A-BS-FO113). La decisión se notifica en audiencia y contra ella procede el recurso de reposición, que se resuelve en la misma.",
        transiciones: [
          { etiqueta: "Declara incumplimiento o impone multa", hacia: "comunicacion" },
          { etiqueta: "Archiva el procedimiento", hacia: "archivo" },
        ],
      },
      {
        clave: "comunicacion",
        nombre: "Comunicación de la decisión",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 5,
        instrucciones: "Publique la decisión en SECOP II y comuníquela a la Cámara de Comercio y a la Procuraduría General de la Nación.",
        transiciones: [{ etiqueta: "Decisión comunicada", hacia: "cierre" }],
      },
      { clave: "cierre", nombre: "Incumplimiento declarado", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
      { clave: "archivo", nombre: "Procedimiento archivado", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
  {
    nombre: "Liquidación del contrato",
    descripcion:
      "Recibo definitivo, proyección y revisión del acta, liquidación bilateral o unilateral, liberación de saldos y cierre del expediente (art. 11 de la Ley 1150 de 2007).",
    aplicaA: null,
    ambito: "CONTRATO",
    pasos: [
      {
        clave: "recibo",
        nombre: "Recibo definitivo e informe final",
        tipo: "TAREA",
        asignacion: "SUPERVISOR",
        slaDiasHabiles: 10,
        instrucciones: "Suscriba el acta de recibo definitivo (A-BS-FO126, o A-BS-FO129 en obra) con el balance financiero y el estado de las obligaciones.",
        transiciones: [{ etiqueta: "Enviar a liquidación", hacia: "proyeccion" }],
      },
      {
        clave: "proyeccion",
        nombre: "Proyección del acta de liquidación",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 5,
        instrucciones: "Proyecte el acta (A-BS-FO135). La liquidación bilateral se hace dentro de los cuatro meses siguientes a la terminación, salvo plazo distinto pactado.",
        transiciones: [{ etiqueta: "Enviar a revisión", hacia: "revision" }],
      },
      {
        clave: "revision",
        nombre: "Revisión del acta",
        tipo: "REVISION",
        asignacion: "MANUAL",
        slaDiasHabiles: 3,
        transiciones: [
          { etiqueta: "Aprobar", hacia: "suscripcion" },
          { etiqueta: "Devolver para ajustes", hacia: "proyeccion" },
        ],
      },
      {
        clave: "suscripcion",
        nombre: "Suscripción con el contratista",
        tipo: "DECISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 10,
        transiciones: [
          { etiqueta: "Acta suscrita de mutuo acuerdo", hacia: "saldos" },
          { etiqueta: "Sin acuerdo o no comparece", hacia: "unilateral" },
        ],
      },
      {
        clave: "unilateral",
        nombre: "Liquidación unilateral",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 20,
        instrucciones: "Proyecte el acto administrativo motivado de liquidación unilateral dentro de los dos meses siguientes al vencimiento del plazo bilateral.",
        transiciones: [{ etiqueta: "Liquidación en firme", hacia: "saldos" }],
      },
      {
        clave: "saldos",
        nombre: "Liberación de saldos y pago final",
        tipo: "TAREA",
        asignacion: "DEPENDENCIA_FIJA",
        dependencia: "Subdirección Administrativa y Financiera - SAF - Grupo Gestión Presupuestal y Eficiencia del Gasto Público",
        slaDiasHabiles: 5,
        transiciones: [{ etiqueta: "Saldos liberados", hacia: "cierre_exp" }],
      },
      {
        clave: "cierre_exp",
        nombre: "Evaluación del proveedor y cierre del expediente",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 5,
        instrucciones: "Diligencie la evaluación de proveedores (A-BS-FO133) y el acta de cierre del expediente (A-BS-FO134) cuando venzan las garantías posteriores.",
        transiciones: [{ etiqueta: "Expediente cerrado", hacia: "cierre" }],
      },
      { clave: "cierre", nombre: "Contrato liquidado", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
  {
    nombre: "Auto de inicio y publicación del trámite",
    descripcion:
      "Con la solicitud completa: proyección del auto de inicio, revisión de la coordinación, firma, publicación en el boletín (art. 70 de la Ley 99 de 1993) y comunicación al solicitante.",
    aplicaA: null,
    ambito: "TRAMITE",
    pasos: [
      {
        clave: "proyeccion",
        nombre: "Proyección del auto de inicio",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Profesional en Derecho / Jurídico",
        slaDiasHabiles: 5,
        instrucciones: "Proyecte el auto que declara iniciado el trámite, con el valor del servicio de evaluación cuando aplique y la orden de publicación.",
        transiciones: [{ etiqueta: "Enviar a revisión", hacia: "revision" }],
      },
      {
        clave: "revision",
        nombre: "Revisión de la coordinación",
        tipo: "REVISION",
        asignacion: "CARGO",
        cargoClave: "Coordinador(a) de Evaluación para la Sostenibilidad",
        slaDiasHabiles: 2,
        transiciones: [
          { etiqueta: "Aprobar para firma", hacia: "firma" },
          { etiqueta: "Devolver con observaciones", hacia: "proyeccion" },
        ],
      },
      {
        clave: "firma",
        nombre: "Firma del auto",
        tipo: "REVISION",
        asignacion: "CARGO",
        cargoClave: "Secretario(a) General",
        slaDiasHabiles: 2,
        transiciones: [
          { etiqueta: "Auto firmado", hacia: "publicacion" },
          { etiqueta: "Devolver con observaciones", hacia: "proyeccion" },
        ],
      },
      {
        clave: "publicacion",
        nombre: "Publicación en el boletín y comunicación",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Servidor(a) de Gestión Documental",
        slaDiasHabiles: 3,
        instrucciones: "Publique el auto en el boletín oficial de la Corporación y comuníquelo al solicitante; deje la constancia en el expediente.",
        transiciones: [{ etiqueta: "Auto publicado", hacia: "cierre" }],
      },
      { clave: "cierre", nombre: "Trámite iniciado", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
  {
    nombre: "Requerimiento de información adicional",
    descripcion:
      "Se revisa la información aportada; si está incompleta se requiere al solicitante por un mes, prorrogable, y si no responde se declara el desistimiento tácito (art. 17 de la Ley 1437 de 2011).",
    aplicaA: null,
    ambito: "TRAMITE",
    pasos: [
      {
        clave: "revision",
        nombre: "Revisión de la información aportada",
        tipo: "DECISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 10,
        transiciones: [
          { etiqueta: "Información completa", hacia: "cierre" },
          { etiqueta: "Información incompleta", hacia: "requerimiento" },
        ],
      },
      {
        clave: "requerimiento",
        nombre: "Oficio de requerimiento",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 3,
        instrucciones: "Indique con precisión la información o los documentos faltantes y el plazo de un mes para aportarlos, prorrogable hasta por un mes más a solicitud del interesado.",
        transiciones: [{ etiqueta: "Requerimiento enviado", hacia: "espera" }],
      },
      {
        clave: "espera",
        nombre: "Espera de la respuesta del solicitante",
        tipo: "DECISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 22,
        instrucciones: "Al vencer el término sin respuesta ni solicitud de prórroga, proceda con el desistimiento tácito.",
        transiciones: [
          { etiqueta: "Respuesta recibida", hacia: "revision" },
          { etiqueta: "Venció sin respuesta", hacia: "desistimiento" },
        ],
      },
      {
        clave: "desistimiento",
        nombre: "Desistimiento tácito y archivo",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Profesional en Derecho / Jurídico",
        slaDiasHabiles: 5,
        instrucciones: "Proyecte el acto motivado que declara el desistimiento y ordena el archivo; contra él procede el recurso de reposición.",
        transiciones: [{ etiqueta: "Desistimiento declarado", hacia: "archivo" }],
      },
      { clave: "cierre", nombre: "Información completa", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
      { clave: "archivo", nombre: "Solicitud archivada", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
  {
    nombre: "Visita técnica y concepto técnico",
    descripcion: "El profesional asignado programa y realiza la visita, elabora el concepto técnico en el formato de visita del trámite y la coordinación le da el visto bueno.",
    aplicaA: null,
    ambito: "TRAMITE",
    pasos: [
      {
        clave: "programacion",
        nombre: "Programación de la visita",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 5,
        instrucciones: "Programe la visita en el planeador e informe la fecha al solicitante.",
        transiciones: [{ etiqueta: "Visita programada", hacia: "visita" }],
      },
      {
        clave: "visita",
        nombre: "Visita técnica",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 10,
        instrucciones: "Diligencie la hoja de visita con coordenadas, registro fotográfico y observaciones de campo.",
        transiciones: [{ etiqueta: "Visita realizada", hacia: "concepto" }],
      },
      {
        clave: "concepto",
        nombre: "Elaboración del concepto técnico",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 15,
        instrucciones: "Emita el concepto técnico con la recomendación de otorgar, negar o requerir información y las obligaciones propuestas.",
        transiciones: [{ etiqueta: "Enviar a visto bueno", hacia: "visto_bueno" }],
      },
      {
        clave: "visto_bueno",
        nombre: "Visto bueno de la coordinación",
        tipo: "REVISION",
        asignacion: "CARGO",
        cargoClave: "Coordinador(a) de Evaluación para la Sostenibilidad",
        slaDiasHabiles: 10,
        transiciones: [
          { etiqueta: "Aprobar", hacia: "cierre" },
          { etiqueta: "Devolver para ajustes", hacia: "concepto" },
        ],
      },
      { clave: "cierre", nombre: "Concepto técnico aprobado", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
  {
    nombre: "Revisión y firma de resolución de fondo",
    descripcion:
      "Proyección de la resolución que otorga o niega el permiso y su cadena de revisión: coordinación, Subdirección de Evaluación y Control Ambiental, asesoría de la Dirección y firma del Director General.",
    aplicaA: null,
    ambito: "TRAMITE",
    pasos: [
      {
        clave: "proyeccion",
        nombre: "Proyección de la resolución",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Profesional en Derecho / Jurídico",
        slaDiasHabiles: 15,
        instrucciones: "Proyecte la resolución con base en el concepto técnico aprobado, con las obligaciones, el término del permiso y los recursos procedentes.",
        transiciones: [{ etiqueta: "Enviar a revisión", hacia: "coordinacion" }],
      },
      {
        clave: "coordinacion",
        nombre: "Revisión de la coordinación",
        tipo: "REVISION",
        asignacion: "CARGO",
        cargoClave: "Coordinador(a) de Evaluación para la Sostenibilidad",
        slaDiasHabiles: 3,
        transiciones: [
          { etiqueta: "Aprobar", hacia: "subdireccion" },
          { etiqueta: "Devolver con observaciones", hacia: "proyeccion" },
        ],
      },
      {
        clave: "subdireccion",
        nombre: "Revisión de la Subdirección",
        tipo: "REVISION",
        asignacion: "CARGO",
        cargoClave: "Subdirector(a) de Evaluación y Control Ambiental (SEYCA)",
        slaDiasHabiles: 3,
        transiciones: [
          { etiqueta: "Aprobar", hacia: "asesoria" },
          { etiqueta: "Devolver con observaciones", hacia: "proyeccion" },
        ],
      },
      {
        clave: "asesoria",
        nombre: "Visto bueno de la asesoría de Dirección",
        tipo: "REVISION",
        asignacion: "CARGO",
        cargoClave: "Asesor(a) de Dirección General",
        slaDiasHabiles: 3,
        transiciones: [
          { etiqueta: "Aprobar para firma", hacia: "firma" },
          { etiqueta: "Devolver con observaciones", hacia: "proyeccion" },
        ],
      },
      {
        clave: "firma",
        nombre: "Firma del Director General",
        tipo: "REVISION",
        asignacion: "CARGO",
        cargoClave: "Director(a) General",
        slaDiasHabiles: 5,
        transiciones: [
          { etiqueta: "Resolución firmada", hacia: "cierre" },
          { etiqueta: "Devolver con observaciones", hacia: "proyeccion" },
        ],
      },
      { clave: "cierre", nombre: "Resolución firmada, lista para notificar", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
  {
    nombre: "Notificación y ejecutoria del acto administrativo",
    descripcion:
      "Citación para notificación personal o electrónica, notificación por aviso si no comparece, término de diez días para recursos y constancia de ejecutoria (arts. 67 a 69 y 87 de la Ley 1437 de 2011).",
    aplicaA: null,
    ambito: "TRAMITE",
    pasos: [
      {
        clave: "citacion",
        nombre: "Citación para notificación personal",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Servidor(a) de Notificaciones",
        slaDiasHabiles: 5,
        instrucciones: "Envíe la citación dentro de los cinco días siguientes a la expedición del acto, o notifique por medio electrónico si el solicitante lo autorizó.",
        transiciones: [{ etiqueta: "Citación enviada", hacia: "personal" }],
      },
      {
        clave: "personal",
        nombre: "Notificación personal",
        tipo: "DECISION",
        asignacion: "CARGO",
        cargoClave: "Servidor(a) de Notificaciones",
        slaDiasHabiles: 5,
        instrucciones: "Entregue copia íntegra del acto e informe los recursos procedentes, la autoridad ante quien se interponen y el plazo.",
        transiciones: [
          { etiqueta: "Notificado personal o electrónicamente", hacia: "recursos" },
          { etiqueta: "No compareció", hacia: "aviso" },
        ],
      },
      {
        clave: "aviso",
        nombre: "Notificación por aviso",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Servidor(a) de Notificaciones",
        slaDiasHabiles: 3,
        instrucciones: "Remita el aviso con copia del acto; la notificación se entiende surtida al finalizar el día siguiente al de la entrega.",
        transiciones: [{ etiqueta: "Aviso entregado", hacia: "recursos" }],
      },
      {
        clave: "recursos",
        nombre: "Término para recursos",
        tipo: "DECISION",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 10,
        transiciones: [
          { etiqueta: "Sin recursos: acto en firme", hacia: "ejecutoria" },
          { etiqueta: "Se interpuso recurso de reposición", hacia: "recurso" },
        ],
      },
      {
        clave: "ejecutoria",
        nombre: "Constancia de ejecutoria y publicación",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Servidor(a) de Gestión Documental",
        slaDiasHabiles: 3,
        instrucciones: "Deje la constancia de ejecutoria y publique la parte resolutiva en el boletín de la Corporación (art. 71 de la Ley 99 de 1993).",
        transiciones: [{ etiqueta: "Acto ejecutoriado", hacia: "cierre" }],
      },
      { clave: "cierre", nombre: "Acto en firme", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
      { clave: "recurso", nombre: "Recurso en trámite", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
  {
    nombre: "Recurso de reposición",
    descripcion:
      "Verificación de requisitos, estudio técnico y jurídico, proyección y firma de la resolución que resuelve el recurso dentro de los dos meses siguientes a su interposición (arts. 77 y 86 de la Ley 1437 de 2011).",
    aplicaA: null,
    ambito: "TRAMITE",
    pasos: [
      {
        clave: "requisitos",
        nombre: "Verificación de requisitos del recurso",
        tipo: "DECISION",
        asignacion: "CARGO",
        cargoClave: "Profesional en Derecho / Jurídico",
        slaDiasHabiles: 5,
        instrucciones: "Verifique la oportunidad (diez días), la sustentación de los motivos de inconformidad y las pruebas que se pretenden hacer valer.",
        transiciones: [
          { etiqueta: "Cumple requisitos", hacia: "estudio" },
          { etiqueta: "No cumple: rechazar", hacia: "proyeccion" },
        ],
      },
      {
        clave: "estudio",
        nombre: "Estudio técnico de los argumentos",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 15,
        instrucciones: "Evalúe los argumentos técnicos y las pruebas aportadas; practique visita si es necesaria y emita concepto.",
        transiciones: [{ etiqueta: "Concepto emitido", hacia: "proyeccion" }],
      },
      {
        clave: "proyeccion",
        nombre: "Proyección de la resolución que resuelve el recurso",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Profesional en Derecho / Jurídico",
        slaDiasHabiles: 10,
        transiciones: [{ etiqueta: "Enviar a revisión", hacia: "revision" }],
      },
      {
        clave: "revision",
        nombre: "Revisión de la Subdirección",
        tipo: "REVISION",
        asignacion: "CARGO",
        cargoClave: "Subdirector(a) de Evaluación y Control Ambiental (SEYCA)",
        slaDiasHabiles: 3,
        transiciones: [
          { etiqueta: "Aprobar para firma", hacia: "firma" },
          { etiqueta: "Devolver con observaciones", hacia: "proyeccion" },
        ],
      },
      {
        clave: "firma",
        nombre: "Firma del Director General",
        tipo: "REVISION",
        asignacion: "CARGO",
        cargoClave: "Director(a) General",
        slaDiasHabiles: 5,
        transiciones: [
          { etiqueta: "Resolución firmada", hacia: "cierre" },
          { etiqueta: "Devolver con observaciones", hacia: "proyeccion" },
        ],
      },
      { clave: "cierre", nombre: "Recurso resuelto, listo para notificar", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
  {
    nombre: "Liquidación y cobro del servicio de evaluación",
    descripcion: "Se liquida el valor del servicio de evaluación según la tarifa vigente, tesorería expide la factura y verifica el pago antes de continuar el trámite.",
    aplicaA: null,
    ambito: "TRAMITE",
    pasos: [
      {
        clave: "liquidacion",
        nombre: "Liquidación del valor",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Profesional o Técnico de Evaluación",
        slaDiasHabiles: 2,
        instrucciones: "Liquide con la autodeclaración de costos del proyecto y la tabla de tarifas vigente de la Corporación.",
        transiciones: [{ etiqueta: "Valor liquidado", hacia: "factura" }],
      },
      {
        clave: "factura",
        nombre: "Expedición de la factura",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Servidor(a) de Facturación / Tesorería",
        slaDiasHabiles: 2,
        transiciones: [{ etiqueta: "Factura enviada", hacia: "pago" }],
      },
      {
        clave: "pago",
        nombre: "Verificación del pago",
        tipo: "DECISION",
        asignacion: "CARGO",
        cargoClave: "Servidor(a) de Facturación / Tesorería",
        slaDiasHabiles: 10,
        transiciones: [
          { etiqueta: "Pago verificado", hacia: "cierre" },
          { etiqueta: "Sin pago en el término", hacia: "requerimiento" },
        ],
      },
      {
        clave: "requerimiento",
        nombre: "Requerimiento de pago al solicitante",
        tipo: "TAREA",
        asignacion: "PERSONAL_ASIGNADO",
        slaDiasHabiles: 3,
        transiciones: [{ etiqueta: "Requerimiento enviado", hacia: "pago" }],
      },
      { clave: "cierre", nombre: "Servicio de evaluación pagado", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
  {
    nombre: "Seguimiento y control del permiso otorgado",
    descripcion:
      "El grupo de seguimiento programa la visita, verifica el cumplimiento de las obligaciones y, según el resultado, cierra el seguimiento, requiere al titular o remite para proceso sancionatorio (Ley 1333 de 2009).",
    aplicaA: null,
    ambito: "TRAMITE",
    pasos: [
      {
        clave: "programacion",
        nombre: "Programación del seguimiento",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Coordinador(a) de Seguimiento para la Sostenibilidad",
        slaDiasHabiles: 5,
        instrucciones: "Asigne al profesional que hará la visita de seguimiento.",
        transiciones: [{ etiqueta: "Asignar profesional", hacia: "visita" }],
      },
      {
        clave: "visita",
        nombre: "Visita y concepto de seguimiento",
        tipo: "DECISION",
        asignacion: "MANUAL",
        slaDiasHabiles: 15,
        instrucciones: "Verifique en campo y en el expediente cada obligación del acto que otorgó el permiso y deje el concepto de seguimiento.",
        transiciones: [
          { etiqueta: "Cumple las obligaciones", hacia: "cierre" },
          { etiqueta: "Incumplimiento subsanable", hacia: "requerimiento" },
          { etiqueta: "Presunta infracción ambiental", hacia: "sancionatorio" },
        ],
      },
      {
        clave: "requerimiento",
        nombre: "Requerimiento al titular",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Profesional en Derecho / Jurídico",
        slaDiasHabiles: 5,
        instrucciones: "Proyecte el acto que requiere al titular el cumplimiento de las obligaciones con un plazo cierto.",
        transiciones: [{ etiqueta: "Requerimiento notificado: verificar cumplimiento", hacia: "visita" }],
      },
      {
        clave: "sancionatorio",
        nombre: "Remisión para proceso sancionatorio",
        tipo: "TAREA",
        asignacion: "CARGO",
        cargoClave: "Profesional en Derecho / Jurídico",
        slaDiasHabiles: 5,
        instrucciones: "Remita el concepto con las pruebas para evaluar la imposición de medidas preventivas y el inicio del procedimiento sancionatorio ambiental.",
        transiciones: [{ etiqueta: "Remitido", hacia: "remitido" }],
      },
      { clave: "cierre", nombre: "Seguimiento cerrado", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
      { clave: "remitido", nombre: "Remitido a sancionatorio", tipo: "FIN", asignacion: "PERSONAL_ASIGNADO" },
    ],
  },
];

export function posicionesPlantilla(pasos: PasoPlantilla[]): Map<string, { x: number; y: number }> {
  const nivel = new Map<string, number>();
  const cola = pasos[0] ? [pasos[0].clave] : [];
  if (pasos[0]) nivel.set(pasos[0].clave, 0);
  const porClave = new Map(pasos.map((p) => [p.clave, p]));
  while (cola.length) {
    const clave = cola.shift()!;
    for (const t of porClave.get(clave)?.transiciones ?? []) {
      if (!nivel.has(t.hacia)) {
        nivel.set(t.hacia, nivel.get(clave)! + 1);
        cola.push(t.hacia);
      }
    }
  }
  let extra = Math.max(0, ...nivel.values()) + 1;
  for (const p of pasos) if (!nivel.has(p.clave)) nivel.set(p.clave, extra++);
  const filas = new Map<number, string[]>();
  for (const p of pasos) filas.set(nivel.get(p.clave)!, [...(filas.get(nivel.get(p.clave)!) ?? []), p.clave]);
  const posiciones = new Map<string, { x: number; y: number }>();
  for (const [n, claves] of filas) {
    claves.forEach((clave, i) => posiciones.set(clave, { x: 160 + (i - (claves.length - 1) / 2) * 240, y: 40 + n * 120 }));
  }
  return posiciones;
}

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
