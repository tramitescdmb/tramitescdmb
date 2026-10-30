import type { Campo, ColumnaTabla, EstructuraFormato, ItemChequeo } from "@/lib/formato-visita";

export type FormatoBase = {
  codigo: string;
  nombre: string;
  titulo: string;
  version: string;
  fechaFormato: string;
  tramites: string[];
  porDefecto?: boolean;
  estructura: EstructuraFormato;
};

const t = (id: string, etiqueta: string, extra: Partial<Campo> = {}): Campo => ({ id, etiqueta, tipo: "texto", ...extra });
const p = (id: string, etiqueta: string, extra: Partial<Campo> = {}): Campo => ({ id, etiqueta, tipo: "parrafo", ...extra });
const n = (id: string, etiqueta: string, unidad?: string, extra: Partial<Campo> = {}): Campo => ({ id, etiqueta, tipo: "numero", ...(unidad ? { unidad } : {}), ...extra });
const sel = (id: string, etiqueta: string, opciones: string[], extra: Partial<Campo> = {}): Campo => ({ id, etiqueta, tipo: "seleccion", opciones, ...extra });
const sn = (id: string, etiqueta: string, extra: Partial<Campo> = {}): Campo => ({ id, etiqueta, tipo: "si_no", ...extra });
const calc = (id: string, etiqueta: string, formula: string, decimales: number, unidad?: string): Campo => ({ id, etiqueta, tipo: "calculado", formula, decimales, ...(unidad ? { unidad } : {}) });
const chequeo = (id: string, etiqueta: string, items: (string | ItemChequeo)[]): Campo => ({
  id,
  etiqueta,
  tipo: "lista_chequeo",
  items: items.map((it) => (typeof it === "string" ? { texto: it, marcado: true } : it)),
});
const col = (id: string, titulo: string, tipo: ColumnaTabla["tipo"] = "texto", extra: Partial<ColumnaTabla> = {}): ColumnaTabla => ({ id, titulo, tipo, ...extra });

const IDENTIFICACION_TITULAR = "{solicitante}, identificado(a) con {identificacion}, del predio denominado «{predio}» identificado con matrícula inmobiliaria No. {matricula}, ubicado en el municipio de {municipio}";

const datosSolicitante: Campo[] = [
  t("solicitante", "Nombre del solicitante o razón social", { precarga: "solicitante", obligatorio: true }),
  t("identificacion", "Identificación del solicitante", { precarga: "identificacion", obligatorio: true }),
  t("representante_legal", "Representante legal"),
  t("cedula_representante", "Cédula del representante legal"),
  t("telefono", "Teléfono", { precarga: "telefono" }),
  t("correo", "Correo electrónico", { precarga: "correo" }),
];

const datosVisita: Campo[] = [
  t("sinca", "SINCA"),
  t("expediente", "Expediente", { precarga: "expediente" }),
  { id: "fecha_visita", etiqueta: "Fecha de visita", tipo: "fecha", precarga: "fecha_visita", obligatorio: true },
  t("funcionario", "Nombre del funcionario que realiza la visita", { precarga: "funcionario", obligatorio: true }),
  t("recibe_visita", "Nombre de la persona que recibe la visita", { obligatorio: true }),
];

export const FORMATO_FORESTAL: FormatoBase = {
  codigo: "M-DA-FO64",
  nombre: "Aprovechamiento forestal",
  titulo: "CONCEPTO TÉCNICO APROVECHAMIENTO FORESTAL",
  version: "1",
  fechaFormato: "02/06/2021",
  tramites: ["M-DA-PR41", "M-DA-PR48"],
  estructura: {
    secciones: [
      {
        id: "datos_generales",
        titulo: "Datos generales",
        campos: [
          ...datosSolicitante,
          p("nombre_proyecto", "Nombre del proyecto", { obligatorio: true }),
          sel(
            "tipo_aprovechamiento",
            "Tipo de aprovechamiento",
            ["Árboles aislados fuera de la cobertura de bosque natural", "Árboles aislados dentro de la cobertura de bosque natural", "Único", "Persistente", "Doméstico", "Poda", "Traslado", "Tala"],
            { obligatorio: true }
          ),
          ...datosVisita,
        ],
      },
      {
        id: "ubicacion",
        titulo: "1. Desarrollo de la visita — ubicación del predio",
        campos: [
          t("municipio", "Municipio", { precarga: "municipio", obligatorio: true }),
          t("vereda", "Vereda", { zona: "vereda", desde: "coordenadas" }),
          t("matricula", "Matrículas inmobiliarias", { precarga: "matricula", multiple: true }),
          t("direccion_predio", "Dirección del predio", { precarga: "direccion_predio" }),
          t("predio", "Nombre del predio", { precarga: "predio" }),
          n("area_predio", "Área del predio", "ha", { precarga: "area_predio" }),
          n("superficie_aprovechar", "Extensión de la superficie a aprovechar", "ha"),
          { id: "coordenadas", etiqueta: "Coordenadas", tipo: "coordenadas", obligatorio: true },
          p("determinantes_ambientales", "Determinantes ambientales del punto", { zona: "resumen_ambiental", desde: "coordenadas", ayuda: "Se llena con las capas de la jurisdicción al capturar las coordenadas; puede ajustarse." }),
        ],
      },
      {
        id: "inventario",
        titulo: "Inventario forestal verificado en campo",
        campos: [
          {
            id: "inventario",
            etiqueta: "Inventario forestal",
            tipo: "tabla",
            obligatorio: true,
            ayuda: "CAP en centímetros y alturas en metros. DAP = √(CAP₁² + CAP₂² + CAP₃²) / π; volumen = π/4 × DAP² × altura × 0,6 (factor de forma).",
            columnas: [
              col("nombre_comun", "Nombre común"),
              col("nombre_cientifico", "Nombre científico"),
              col("cap1", "CAP 1 (cm)", "numero", { decimales: 0 }),
              col("cap2", "CAP 2 (cm)", "numero", { decimales: 0, vacioComoCero: true }),
              col("cap3", "CAP 3 (cm)", "numero", { decimales: 0, vacioComoCero: true }),
              col("cap_total", "CAP total (cm)", "calculado", { formula: "raiz(cap1^2 + cap2^2 + cap3^2)", decimales: 0 }),
              col("dap", "DAP (m)", "calculado", { formula: "cap_total / pi / 100", decimales: 2 }),
              col("altura_comercial", "Altura comercial (m)", "numero", { decimales: 1 }),
              col("altura_total", "Altura total (m)", "numero", { decimales: 1 }),
              col("vol_comercial", "Volumen comercial (m³)", "calculado", { formula: "pi / 4 * dap^2 * altura_comercial * 0.6", decimales: 2, total: true }),
              col("vol_total", "Volumen total (m³)", "calculado", { formula: "pi / 4 * dap^2 * altura_total * 0.6", decimales: 2, total: true }),
              col("este", "Este", "numero", { decimales: 0 }),
              col("norte", "Norte", "numero", { decimales: 0 }),
            ],
            agrupar: { por: ["nombre_comun", "nombre_cientifico"], sumar: ["vol_comercial", "vol_total"], titulo: "Inventario del volumen por especie" },
          },
          calc("cantidad_arboles", "Cantidad de árboles", "inventario._filas", 0, "individuo(s)"),
          calc("volumen_total", "Volumen total", "inventario.vol_total", 2, "m³"),
          calc("volumen_comercial", "Volumen comercial", "inventario.vol_comercial", 2, "m³"),
          sel("forma_otorgamiento", "Forma de otorgamiento", ["Autorización", "Permiso", "Concesión", "Asociación"]),
        ],
      },
      {
        id: "estado_arboles",
        titulo: "Estado de los árboles objeto de aprovechamiento",
        campos: [
          sel("estado_fitosanitario", "Estado fitosanitario", ["Bueno", "Regular", "Malo"], { obligatorio: true }),
          p("estado_descripcion", "Descripción del estado de los árboles", {
            plantilla:
              "En la visita técnica se logró verificar que los individuos arbóreos presentan {estado_fitosanitario} estado fitosanitario y desarrollo normal; NO se observa presencia de especies epífitas en los árboles objeto de intervención.",
          }),
          sn("presenta_veda", "¿Presenta veda?", { obligatorio: true }),
          p("veda_justificacion", "Justificación sobre especies en veda o amenaza", {
            plantilla:
              "De acuerdo con el inventario presentado y la verificación realizada en campo, los individuos arbóreos no se encuentran en ninguna restricción de especies en veda y amenaza, de acuerdo con lo verificado en la Resolución No. 0196 de 2017 CDMB, el listado de especies amenazadas de la Unión Internacional para la Conservación de la Naturaleza (UICN) y la Resolución No. 0126 de 2024 de MINAMBIENTE.",
          }),
          sn("epifitas", "¿Existencia de epífitas vasculares?", { obligatorio: true }),
          p("epifitas_descripcion", "Observaciones sobre epífitas", {
            plantilla:
              "En la información aportada en el inventario forestal presentado por el solicitante y lo verificado en la visita de inspección ocular NO se reporta existencia de especies epífitas.",
          }),
        ],
      },
      {
        id: "verificacion",
        titulo: "Verificación del inventario y cobertura",
        campos: [
          p("verificacion_inventario", "Verificación del inventario", {
            obligatorio: true,
            plantilla:
              "Se realizó visita técnica de inspección ocular el día {fecha_visita}, en compañía de {recibe_visita}, con quien se verificaron las principales características físicas de los árboles relacionados en el inventario presentado por el solicitante. Se procedió a realizar reconocimiento en campo de la información presentada en el inventario forestal, corroborando nombre y tipo de especie, DAP y altura; los datos presentados concuerdan con los tomados en campo y las variaciones del diámetro evidenciadas son menores (± 3 cm de DAP), por lo cual es posible afirmar que lo presentado en el inventario forestal es confiable.",
          }),
          chequeo("apreciaciones", "Apreciaciones", [
            "Verificando los cálculos de las medidas dasométricas se corroboró que no presentan inconsistencias con las aportadas en el inventario forestal presentado.",
            "No se evidenciaron especies epífitas asociadas a los árboles solicitados.",
            "Según indicaciones efectuadas durante la visita, la madera será dispuesta en los sitios indicados y aprobados por la CDMB para su disposición final.",
          ]),
          t("cobertura_corine", "Tipo de cobertura (CORINE Land Cover)", { ayuda: "Ejemplo: Mosaico de cultivos, código 2.4.1." }),
          p("zonificacion_pgof", "Zonificación según PGOF"),
          p("zonificacion_pot", "Zonificación según POT del municipio"),
        ],
      },
      {
        id: "aprovechamiento",
        titulo: "Uso del suelo, sistemas y vigencia del aprovechamiento",
        campos: [
          p("uso_suelo_despues", "Uso del suelo después del aprovechamiento", {
            plantilla: "El uso del suelo después del aprovechamiento de árboles aislados fuera de cobertura de bosque natural se destinará para la ejecución del proyecto.",
          }),
          p("sistemas_aprovechamiento", "Sistemas de aprovechamiento", {
            plantilla:
              "El aprovechamiento se debe realizar con el proceso adecuado, el cual inicia con la revisión de presencia de nidos y el ahuyentamiento o reubicación de especies de fauna silvestre; posteriormente desrame, descope y corte del fuste en partes no mayores a un (1) metro para evitar afectaciones a la vegetación cercana.",
          }),
          n("vigencia_anios", "Vigencia del aprovechamiento", "año(s)", { decimales: 0 }),
          sn("comercializacion", "¿Se autoriza la comercialización?"),
        ],
      },
      {
        id: "compensacion",
        titulo: "Medidas de mitigación, compensación y restauración",
        campos: [
          n("relacion_compensacion", "Individuos a plantar por cada árbol talado", undefined, { decimales: 0 }),
          calc("individuos_compensacion", "Individuos a compensar", "inventario._filas * relacion_compensacion", 0, "individuo(s)"),
          n("anios_mantenimiento", "Años de mantenimiento de la compensación", "año(s)", { decimales: 0 }),
          p("compensacion_texto", "Medida de compensación", {
            plantilla:
              "Como medida de compensación por la tala de {cantidad_arboles} con volumen total a aprovechar de {volumen_total} de madera en bruto y {volumen_comercial} de madera comercial, se deberá realizar una compensación de {individuos_compensacion} de especies forestales nativas seleccionadas por su capacidad de proveer alimento y refugio a la fauna silvestre, plantados con altura mínima de 50 cm y con mantenimiento por un término de {anios_mantenimiento}.",
          }),
          p("derechos_tasas", "Derechos y tasas", {
            plantilla: "En atención al objeto de la presente autorización, no se establece ningún tipo de derechos o tasas.",
          }),
        ],
      },
      {
        id: "obligaciones",
        titulo: "Recomendaciones y obligaciones del permisionario",
        campos: [
          chequeo("obligaciones", "Obligaciones", [
            "Antes de iniciar las actividades de aprovechamiento forestal se deben revisar los árboles con el fin de detectar la presencia de nidos, los cuales deben ser reubicados en áreas cercanas con características similares, o en su defecto esperar el abandono del nido.",
            `Previo a la intervención de los árboles, al evidenciar presencia de grupos taxonómicos de fauna, es responsabilidad de ${IDENTIFICACION_TITULAR}, presentar al grupo de seguimiento para la sostenibilidad de la CDMB el procedimiento a llevar a cabo y el cronograma de actividades de ahuyentamiento, reubicación y traslado de fauna.`,
            "Para la medida de compensación deberá presentar en el término de dos (2) meses contados a partir de la ejecutoria del acto administrativo el Plan de Compensación Forestal, firmado por profesional idóneo.",
            "Las medidas de compensación deberán iniciar a más tardar dentro de los seis (6) meses siguientes a la intervención o a la aprobación del Plan de Compensación, con mantenimiento y control fitosanitario mínimo por tres (3) años e informes semestrales a la CDMB.",
            "La compensación deberá localizarse preferiblemente en áreas de influencia directa del proyecto o dentro de áreas de importancia para la conservación.",
            "Si en el momento de realizar el aprovechamiento forestal se evidencia la presencia de especies epífitas diferentes a las reportadas, se deberá informar inmediatamente a la CDMB.",
            "Si se determina la necesidad de intervención de nuevos individuos, se deberá presentar la solicitud a la CDMB para su evaluación.",
            "Propender por el cuidado y conservación de las fuentes hídricas que rodean los predios, realizando actividades de revegetalización en la franja de protección con especies nativas.",
            `${IDENTIFICACION_TITULAR}, deberá realizar la inscripción en el Registro Único Ambiental (RUA) conforme a la Resolución 0839 de 2023 dentro de los treinta (30) días calendario siguientes a la notificación del acto administrativo.`,
            "La CDMB podrá realizar visitas de seguimiento al proyecto cuando lo considere necesario.",
            { texto: "En caso de que los individuos arbóreos cuenten con código o número de identificación, el usuario deberá informar al municipio con el fin de que se actualice el censo forestal." },
          ]),
        ],
      },
      {
        id: "concepto",
        titulo: "Concepto técnico",
        campos: [
          sel("decision", "Recomendación técnica", ["AUTORIZAR", "NO AUTORIZAR", "REQUERIR INFORMACIÓN ADICIONAL"], { obligatorio: true }),
          p("concepto_tecnico", "Concepto técnico", {
            obligatorio: true,
            plantilla: `De acuerdo con la visita técnica realizada el día {fecha_visita} y la documentación presentada por ${IDENTIFICACION_TITULAR}, se recomienda técnicamente {decision} el aprovechamiento forestal de {cantidad_arboles}, con volumen total a aprovechar de {volumen_total} de madera en bruto y {volumen_comercial} de madera comercial.`,
          }),
        ],
      },
    ],
  },
};

export const FORMATO_AGUAS: FormatoBase = {
  codigo: "M-DA-FO59",
  nombre: "Concesión de aguas superficiales",
  titulo: "CONCEPTO TÉCNICO CONCESIÓN AGUAS SUPERFICIALES",
  version: "1",
  fechaFormato: "02/06/2021",
  tramites: ["M-DA-PR21"],
  estructura: {
    secciones: [
      {
        id: "datos_generales",
        titulo: "Datos generales",
        campos: [
          ...datosSolicitante,
          t("ciiu", "Código CIIU"),
          t("municipio", "Municipio", { precarga: "municipio", obligatorio: true }),
          t("vereda", "Vereda", { zona: "vereda", desde: "coord_captacion" }),
          t("matricula", "Matrículas inmobiliarias", { precarga: "matricula", multiple: true }),
          t("predio", "Nombre o dirección del predio", { precarga: "predio" }),
          n("area_predio", "Área del predio", "ha", { precarga: "area_predio" }),
          t("catastral", "No. catastral", { precarga: "catastral" }),
          n("costo_proyecto", "Costo del proyecto, obra o actividad", "pesos", { decimales: 0 }),
          t("uso_solicitado", "Uso solicitado", { obligatorio: true, ayuda: "Ejemplo: Doméstico (con consumo humano) y riego." }),
          ...datosVisita,
        ],
      },
      {
        id: "caudales",
        titulo: "Caudales",
        campos: [
          n("caudal_aforado", "Caudal aforado de la fuente", "l/s", { obligatorio: true, decimales: 2 }),
          n("caudal_minimo", "Caudal medio mínimo estimado", "l/s", { obligatorio: true, decimales: 4 }),
          calc("caudal_autorizar", "Caudal a autorizar", "consumo.ls", 4, "l/s"),
          calc("porcentaje_autorizar", "Porcentaje a autorizar", "caudal_autorizar / caudal_minimo * 100", 0, "%"),
        ],
      },
      {
        id: "fuente",
        titulo: "1. Desarrollo de la visita técnica",
        campos: [
          t("codigo_tramo_ideam", "Código tramo IDEAM"),
          t("fuente_hidrica", "Fuente hídrica", { obligatorio: true }),
          t("codigo_fuente", "Código de la fuente"),
          t("microcuenca", "Microcuenca"),
          t("subcuenca", "Subcuenca"),
          t("cuenca", "Cuenca / subzona hidrográfica", { zona: "subzona_hidrografica", desde: "coord_captacion" }),
          sel("tipo_fuente", "Tipo de fuente hídrica", ["Caño", "Quebrada", "Río", "Nacimiento", "Manantial", "Lago o laguna", "Otro"]),
          p("condiciones_biofisicas", "Condiciones biofísicas"),
          { id: "coord_captacion", etiqueta: "Coordenadas del punto de captación", tipo: "coordenadas", conCota: true, obligatorio: true },
          p("determinantes_ambientales", "Determinantes ambientales del punto de captación", { zona: "resumen_ambiental", desde: "coord_captacion" }),
          p("predios_beneficiados", "Nombre del predio(s), municipio o comunidades que se van a beneficiar y su jurisdicción (incluya la vía de acceso)"),
          p("clasificacion_suelo", "Clasificación del suelo"),
          p("tipo_centro_poblado", "Tipo de centro poblado"),
          p("area_cultivos", "Área en cultivos"),
          p("area_bosque", "Área en bosque"),
          p("espacio_industrial", "Espacio industrial o productivo"),
          p("numero_viviendas", "Número de viviendas y su descripción"),
          p("saneamiento_basico", "Sistema de saneamiento básico"),
          p("destinacion_recurso", "Información sobre la destinación del recurso"),
          n("cantidad_solicitada", "Cantidad de agua que se desea utilizar", "l/s"),
          p("sistemas_captacion", "Sistemas para captación, derivación, conducción, restitución de sobrantes, distribución y drenaje; inversiones, cuantía y término de ejecución"),
          p("servidumbre", "¿Requiere servidumbre para el aprovechamiento del recurso o construcción de las obras?"),
          p("termino_solicitado", "Término por el cual solicita la concesión"),
          p("extension_cultivos", "Extensión y clase de cultivos que se benefician"),
          p("aforos", "Aforos de la fuente de origen"),
          {
            id: "usuarios_fuente",
            etiqueta: "Usuarios que se abastecen de la misma fuente",
            tipo: "tabla",
            columnas: [col("expediente", "Expediente"), col("cota", "Cota", "numero", { decimales: 0 }), col("nombre", "Nombre")],
          },
          p("disponibilidad_fuente", "Análisis de disponibilidad del recurso", {
            plantilla:
              "Tras la revisión del punto de captación de esta fuente hídrica, y con base en la evidencia observada en campo y la cota del punto, se determinó que la disponibilidad del recurso para la presente solicitud no se ve afectada en el cumplimiento de las obligaciones estipuladas para los usuarios, respetando el caudal ecológico de la misma.",
          }),
          p("derivaciones", "Existencia de derivaciones para otros usos que puedan resultar afectados"),
          p("obras_terrenos", "¿Las obras ocupan terrenos diferentes al dueño del predio que se beneficiaría? Razón técnica"),
          p("restitucion_sobrantes", "Lugar y forma de restitución de sobrantes"),
          p("restitucion_causa", "Si no es posible la restitución, la causa"),
          p("estudio_factibilidad", "Análisis del estudio de factibilidad"),
        ],
      },
      {
        id: "servicio_publico",
        titulo: "Información especial para prestación de servicio público",
        campos: [
          t("sp_detalle_obras", "Detalle de las obras"),
          t("sp_extension", "Extensión"),
          n("sp_habitantes", "No. de habitantes", "habitante(s)", { decimales: 0 }),
          t("sp_plazo", "Plazo durante la prestación del servicio"),
          t("sp_reglamentacion", "Reglamentación del servicio"),
        ],
      },
      {
        id: "necesidades",
        titulo: "2. Análisis de necesidades — características del consumo de agua",
        campos: [
          {
            id: "consumo",
            etiqueta: "Características del consumo de agua",
            tipo: "tabla",
            obligatorio: true,
            ayuda: "Total l/s = dotación × cantidad / 86.400, redondeado a cuatro decimales; total l/d = total l/s × 86.400.",
            columnas: [
              col("uso", "Uso"),
              col("dotacion", "Dotación", "numero"),
              col("unidad", "Unidad de dotación"),
              col("cantidad", "Cantidad", "numero"),
              col("ls", "Total l/s", "calculado", { formula: "redondear(dotacion * cantidad / 86400, 4)", decimales: 4, total: true }),
              col("ld", "Total l/d", "calculado", { formula: "ls * 86400", decimales: 2, total: true }),
            ],
            filasIniciales: [
              { uso: "Doméstico (con consumo humano - Permanentes)", dotacion: "150", unidad: "l/d*hab" },
              { uso: "Doméstico (con consumo humano - Transitorias)", dotacion: "50", unidad: "l/d*hab" },
              { uso: "Riego", dotacion: "0,5", unidad: "l*m²" },
            ],
          },
        ],
      },
      {
        id: "recomendaciones",
        titulo: "3. Recomendaciones técnicas",
        campos: [
          sel("viabilidad", "Viabilidad técnica", ["VIABLE", "NO VIABLE", "REQUIERE INFORMACIÓN ADICIONAL"], { obligatorio: true }),
          p("recomendacion_texto", "Recomendación", {
            obligatorio: true,
            plantilla:
              "Se considera {viabilidad} técnicamente otorgar concesión de aguas superficiales a {solicitante}, identificado(a) con {identificacion}, con captación de la fuente hídrica {fuente_hidrica} código {codigo_fuente}, que hace parte de la red hídrica de la microcuenca {microcuenca}, subcuenca {subcuenca} y cuenca {cuenca}, un caudal total de {caudal_autorizar}, para uso {uso_solicitado}, en beneficio del predio «{predio}» identificado con matrícula inmobiliaria número {matricula}, ubicado en la vereda {vereda} del municipio de {municipio}.",
          }),
          {
            id: "puntos_recepcion",
            etiqueta: "Coordenadas planas de los puntos de recepción",
            tipo: "tabla",
            columnas: [col("punto", "Punto"), col("norte", "Norte", "numero", { decimales: 0 }), col("este", "Este", "numero", { decimales: 0 }), col("cota", "Cota (m s. n. m.)", "numero", { decimales: 0 })],
          },
          n("termino_anios", "Término de la concesión", "año(s)", { decimales: 0 }),
          n("plantulas", "Plántulas nativas a sembrar", undefined, { decimales: 0 }),
          chequeo("obligaciones", "Obligaciones", [
            "La presente concesión se otorga por el término de {termino_anios}, contados a partir de la ejecutoria de la presente resolución, prorrogables a solicitud del interesado dentro del último año de su vigencia.",
            "Aprobar el programa de Uso Eficiente y Ahorro del Agua (PUEAA) simplificado presentado por {solicitante}, conforme al artículo 3 de la Resolución MADS 1257 de 2018; el titular deberá ejecutar las actividades establecidas: instalación de flotadores en los tanques, mantenimiento de los sistemas hidráulicos, buen estado de las tuberías, recolección de aguas lluvias, reúso del agua, devolución de reboses, protección de la fuente y tecnologías de bajo consumo.",
            "El permisionario deberá presentar anualmente a la Autoridad Ambiental un informe con los soportes que demuestren el avance, cumplimiento y desarrollo de las actividades del PUEAA.",
            { texto: "En un término de hasta un (1) año deberá tramitar ante la Autoridad Ambiental el permiso de vertimientos al agua o suelo, junto con los estudios, diseños, memorias y planos del sistema de saneamiento básico individual de las viviendas, conforme al artículo 2.2.3.3.5.1 del Decreto 1076 de 2015 y la Resolución 330 de 2017." },
            "El permiso otorgado no grava servidumbres de uso y/o paso sobre los predios vecinos. Estas deberán ser constituidas a costa del solicitante.",
            "Para la contribución con el incremento de la biomasa y la conservación paisajística, el permisionario deberá sembrar {plantulas} plántulas de especies nativas con alturas superiores a 0,50 m y realizar dos mantenimientos como mínimo al año durante los tres primeros años.",
            "{solicitante} deberá llevar a cabo la inscripción en el Registro Único Ambiental (RUA) de acuerdo con la Resolución 0839 de 2023 dentro de los treinta (30) días calendario siguientes a la notificación.",
            "Los caudales y forma de captación serán respetados en toda época. Los usuarios con caudales superiores a 0,05 l/s deberán colocar un contador o medidor de caudal, verificable por la CDMB en cualquier momento.",
            "Según la Resolución 011 de 2010 de la CDMB, quedan prohibidas las quemas en el área de jurisdicción.",
            "El beneficiario deberá cancelar anualmente la visita de seguimiento a la concesión, de acuerdo con las tarifas aprobadas por la CDMB.",
            "Deberá velar por que las fuentes de captación no sufran contaminación por vertimientos, desechos, agroquímicos, basuras o residuos de la actividad agropecuaria.",
            "El beneficiario deberá colocar a su costa, en un lugar visible, una valla informativa con el logo de la CDMB y los datos básicos de la concesión.",
            "Deberá garantizar la conservación de la microcuenca abastecedora y de las rondas de protección (hasta 30 m en cauces y 100 m en nacimientos), aislando la zona de protección hídrica.",
            "La presente concesión no exime al usuario de tramitar otros permisos ambientales que se requieran.",
            "El suministro de agua está sujeto a la disponibilidad del recurso; se deberá permitir en todo tiempo el paso del 25 % del caudal disponible correspondiente al caudal ecológico.",
            "La concesión podrá ser modificada si la fuente entra en proceso de reglamentación de corrientes, por agotamiento u otra circunstancia que lo amerite.",
            "El permisionario deberá pagar ante la CDMB la tasa por uso, año vencido, según el Decreto 1076 de 2015.",
          ]),
        ],
      },
    ],
  },
};

const PARAMETROS_699: { parametro: string; unidad: string }[] = [
  { parametro: "Temperatura", unidad: "°C" },
  { parametro: "pH", unidad: "Unidades de pH" },
  { parametro: "Demanda Química de Oxígeno (DQO)", unidad: "mg/L O2" },
  { parametro: "Demanda Bioquímica de Oxígeno (DBO5)", unidad: "mg/L O2" },
  { parametro: "Sólidos Suspendidos Totales (SST)", unidad: "mg/L" },
  { parametro: "Sólidos Sedimentables (SSED)", unidad: "mL/L" },
  { parametro: "Grasas y aceites", unidad: "mg/L" },
  { parametro: "Fenoles", unidad: "mg/L" },
  { parametro: "Sustancias Activas al Azul de Metileno (SAAM)", unidad: "mg/L" },
  { parametro: "Conductividad eléctrica", unidad: "uS/cm" },
  { parametro: "Fósforo Total", unidad: "mg/L" },
  { parametro: "Nitratos", unidad: "mg/L" },
  { parametro: "Nitrógeno Total", unidad: "mg/L" },
  { parametro: "Relación de Absorción de Sodio (RAS)", unidad: "Adimensional" },
  { parametro: "Cloruros", unidad: "mg/L" },
  { parametro: "Sulfatos", unidad: "mg/L" },
  { parametro: "Aluminio", unidad: "mg/L" },
  { parametro: "Cadmio", unidad: "mg/L" },
  { parametro: "Cinc", unidad: "mg/L" },
  { parametro: "Cobre", unidad: "mg/L" },
  { parametro: "Cromo", unidad: "mg/L" },
  { parametro: "Manganeso", unidad: "mg/L" },
  { parametro: "Plata", unidad: "mg/L" },
  { parametro: "Plomo", unidad: "mg/L" },
  { parametro: "Hidrocarburos Totales", unidad: "mg/L" },
  { parametro: "Coliformes Totales", unidad: "NMP/100mL" },
];

const LIMITES_CATEGORIA_III: Record<string, string> = {
  Temperatura: "±5 temperatura media anual multianual",
  pH: "6,5 a 8,5",
  "Demanda Química de Oxígeno (DQO)": "200,0",
  "Demanda Bioquímica de Oxígeno (DBO5)": "90,0",
  "Sólidos Suspendidos Totales (SST)": "50,0",
  "Sólidos Sedimentables (SSED)": "1,5",
  "Grasas y aceites": "20,0",
  Fenoles: "0,01",
  "Sustancias Activas al Azul de Metileno (SAAM)": "0,5",
  "Conductividad eléctrica": "700,0",
  "Fósforo Total": "2,0",
  Nitratos: "10,0",
  "Nitrógeno Total": "20,0",
  "Relación de Absorción de Sodio (RAS)": "3,0",
  Cloruros: "140,0",
  Sulfatos: "250,0",
  Aluminio: "1,0",
  Cadmio: "Análisis y Reporte",
  Cinc: "2,0",
  Cobre: "1,0",
  Cromo: "Análisis y Reporte",
  Manganeso: "0,2",
  Plata: "0,05",
  Plomo: "0,1",
  "Hidrocarburos Totales": "1,0",
  "Coliformes Totales": "Análisis y Reporte",
};

const cumple = (id: string, etiqueta: string): Campo => sel(id, etiqueta, ["CUMPLE", "NO CUMPLE", "NO APLICA"]);

export const FORMATO_VERTIMIENTOS: FormatoBase = {
  codigo: "M-DA-FO75",
  nombre: "Permiso de vertimiento al suelo",
  titulo: "INFORME TÉCNICO PERMISO DE VERTIMIENTO - SUELO",
  version: "01",
  fechaFormato: "",
  tramites: ["M-DA-PR05"],
  estructura: {
    secciones: [
      {
        id: "datos_generales",
        titulo: "Datos generales",
        campos: [
          t("solicitante", "Nombre del solicitante", { precarga: "solicitante", obligatorio: true }),
          t("identificacion", "Identificación del solicitante", { precarga: "identificacion", obligatorio: true }),
          t("representante_legal", "Representante legal"),
          t("nit", "NIT"),
          t("telefono", "Teléfono", { precarga: "telefono" }),
          t("correo", "Correo electrónico", { precarga: "correo" }),
          t("municipio", "Municipio", { precarga: "municipio", obligatorio: true }),
          t("vereda", "Vereda", { zona: "vereda", desde: "coord_predio" }),
          t("matricula", "Matrículas inmobiliarias", { precarga: "matricula", multiple: true }),
          t("predio", "Predio", { precarga: "predio" }),
          t("catastral", "No. catastral", { precarga: "catastral" }),
          p("nombre_proyecto", "Nombre del proyecto, obra o actividad", { obligatorio: true }),
          n("costo_proyecto", "Costo del proyecto, obra o actividad", "pesos", { decimales: 0 }),
          t("direccion", "Dirección", { precarga: "direccion_predio" }),
          t("sinca", "SINCA"),
          t("expediente", "Expediente", { precarga: "expediente" }),
          { id: "fecha_visita", etiqueta: "Fecha de visita", tipo: "fecha", precarga: "fecha_visita", obligatorio: true },
          t("funcionario", "Nombre del funcionario que realiza la visita", { precarga: "funcionario", obligatorio: true }),
        ],
      },
      {
        id: "establecimiento",
        titulo: "Descripción general del establecimiento",
        campos: [
          p("fuente_abastecimiento", "Fuente de abastecimiento"),
          p("ecosistemas_clave", "Localización de los ecosistemas considerados clave para la regulación de la oferta hídrica", { zona: "resumen_ambiental", desde: "coord_vertimiento" }),
          { id: "coord_predio", etiqueta: "Georreferenciación del predio (sistema de tratamiento)", tipo: "coordenadas", conCota: true, obligatorio: true },
          { id: "coord_vertimiento", etiqueta: "Georreferenciación del vertimiento", tipo: "coordenadas", conCota: true, obligatorio: true },
          p("actividades_vertimiento", "Características de las actividades que generan vertimiento"),
          sel("medio_receptor", "Medio receptor", ["Suelo – Campo de infiltración", "Suelo – Zanja de infiltración", "Suelo – Pozo de absorción", "Cuerpo de agua", "Otro"], { obligatorio: true }),
          p("caudal_descarga", "Caudal de descarga (l/s)", { ayuda: "Caudal de diseño, caudal teórico según dotación y caudal de monitoreo." }),
          n("frecuencia", "Frecuencia", "día(s)/mes", { decimales: 0 }),
          n("tiempo_descarga", "Tiempo de descarga", "h/día"),
          sel("tipo_flujo", "Tipo de flujo", ["Continuo", "Intermitente"]),
          n("tasa_infiltracion", "Tasa de infiltración", "mm/h"),
        ],
      },
      {
        id: "caracterizacion",
        titulo: "Caracterización según Resolución 699 de 2021",
        campos: [
          t("sector_usuario", "Sector / usuario"),
          sel("categoria", "Actividad / categoría", [
            "Categoría I. Velocidad de infiltración entre 16 y 27 mm/h",
            "Categoría II. Velocidad de infiltración entre 2,6 a 15 mm/h o entre 28 a 52 mm/h",
            "Categoría III. Velocidad de infiltración menor a 2,5 mm/h o mayor a 53 mm/h",
          ]),
          { id: "fecha_monitoreo", etiqueta: "Fecha del monitoreo reportado", tipo: "fecha" },
          {
            id: "parametros",
            etiqueta: "Parámetros de la caracterización",
            tipo: "tabla",
            ayuda: "Ajuste los límites a la categoría que corresponda. El cumplimiento se calcula al comparar la concentración con el límite; admite valores como «< 0,5» y rangos «7,51 a 7,02».",
            columnas: [
              col("parametro", "Parámetro"),
              col("unidad", "Unidades"),
              col("limite", "Límite admisible Res. 699 de 2021"),
              col("resultado", "Concentración reportada"),
              col("cumplimiento", "Cumplimiento", "cumplimiento", { limite: "limite", resultado: "resultado" }),
            ],
            filasIniciales: PARAMETROS_699.map((x) => ({ parametro: x.parametro, unidad: x.unidad, limite: LIMITES_CATEGORIA_III[x.parametro] ?? "" })),
          },
          p("observaciones_caracterizacion", "Observaciones de la caracterización"),
        ],
      },
      {
        id: "operacion",
        titulo: "Sistema de tratamiento y uso del suelo",
        campos: [
          p("operacion_sistema", "Descripción de la operación del sistema de tratamiento de aguas residuales", { obligatorio: true }),
          p("concepto_uso_suelo", "Concepto de uso de suelo expedido por la entidad territorial"),
          sn("causales_prohibicion", "¿Se encuentra inmerso en causales de prohibición (art. 2.2.3.3.4.3)?"),
          sn("actividades_no_permitidas", "¿Actividades no permitidas (art. 2.2.3.3.4.4)?"),
        ],
      },
      {
        id: "evaluacion_ambiental",
        titulo: "Evaluación ambiental del vertimiento",
        campos: [
          cumple("eav_insumos", "Naturaleza de los insumos, productos químicos, formas de energía y procesos utilizados"),
          p("eav_insumos_obs", "Observaciones — insumos y procesos"),
          cumple("eav_impactos_agua", "Predicción y valoración de impactos al cuerpo de agua"),
          cumple("eav_impactos_suelo", "Predicción y valoración de impactos al suelo"),
          p("eav_impactos_obs", "Observaciones — impactos"),
          cumple("eav_residuos", "Manejo de residuos asociados a la gestión del vertimiento"),
          p("eav_residuos_obs", "Observaciones — residuos"),
          cumple("eav_medidas", "Medidas para prevenir, mitigar, corregir y compensar los impactos"),
          cumple("eav_sociocultural", "Posible incidencia en la calidad de vida y condiciones socioeconómicas y culturales"),
          cumple("eav_descarga", "Estudios técnicos y diseños de la estructura de descarga"),
          p("eav_descarga_obs", "Observaciones — estructura de descarga"),
          cumple("pgrmv", "Plan de gestión del riesgo para el manejo del vertimiento (Res. 1514 de 2012)"),
          cumple("plan_contingencia", "Plan de contingencia para la prevención y control de derrames"),
          cumple("constancia_pago", "Constancia de pago del servicio de evaluación"),
          cumple("manual_operacion", "Manual de operación y mantenimiento del sistema de tratamiento"),
        ],
      },
      {
        id: "condiciones_sitio",
        titulo: "Condiciones del sitio de disposición",
        campos: [
          p("instrumentos_planificacion", "Instrumentos de planificación del recurso hídrico"),
          p("otra_alternativa", "Existencia de otra alternativa"),
          sn("alcantarillado", "¿Existe un sistema de alcantarillado al cual el usuario pueda conectarse?"),
          p("vulnerabilidad_acuifero", "Condiciones de vulnerabilidad del acuífero"),
          p("hidrogeologia", "Estudios hidrogeológicos del área de interés"),
          p("evento_amenazante", "¿Existe algún tipo de evento amenazante?"),
          p("vertimientos_colindantes", "Vertimientos al suelo y sistemas de tratamiento en predios colindantes"),
          p("usos_suelo_ot", "Usos del suelo previstos en los instrumentos de ordenamiento territorial"),
          p("humedad_taxonomia", "Condiciones de régimen de humedad y orden taxonómico del suelo"),
        ],
      },
      {
        id: "ard",
        titulo: "Agua residual doméstica",
        campos: [
          cumple("ard_tasa_infiltracion", "Tasa de infiltración"),
          p("ard_tasa_infiltracion_obs", "Observaciones — tasa de infiltración"),
          cumple("ard_sistema_disposicion", "Sistema de disposición de los vertimientos"),
          p("ard_sistema_disposicion_obs", "Observaciones — sistema de disposición"),
          cumple("ard_area_disposicion", "Área de disposición / polígono delimitado por coordenadas MAGNA-SIRGAS"),
          {
            id: "poligono",
            etiqueta: "Coordenadas del polígono de disposición",
            tipo: "tabla",
            columnas: [col("zona", "Zona"), col("x", "X", "numero", { decimales: 3 }), col("y", "Y", "numero", { decimales: 3 })],
          },
          p("ard_area_disposicion_obs", "Observaciones — área de disposición"),
          cumple("ard_plan_cierre", "Plan de cierre y abandono del área de disposición"),
        ],
      },
      {
        id: "decision",
        titulo: "Término, obligaciones y recomendaciones",
        campos: [
          p("termino_permiso", "Término por el cual se otorga el permiso y condiciones para su renovación"),
          p("obras_permisionario", "Relación de las obras que debe construir el permisionario"),
          chequeo("prohibiciones", "Prohibiciones para la actividad", [
            "La utilización del recurso hídrico, de las aguas lluvias, de las provenientes de acueductos públicos o privados, de enfriamiento, de aire acondicionado, de condensación y/o de síntesis química, con el propósito de diluir los vertimientos, con anterioridad al punto de control del vertimiento.",
            "El lavado de vehículos de transporte terrestre en las orillas y en los cuerpos de agua, así como el de aplicadores de agroquímicos y otras sustancias tóxicas y sus envases.",
            "Disponer en cuerpos de agua y sistemas de alcantarillado los sedimentos, lodos y sustancias sólidas provenientes de sistemas de tratamiento de agua o equipos de control ambiental.",
            "Los vertimientos no podrán presentar material flotante y espumas que formen película visible ni sustancias que produzcan olores ofensivos.",
            "Se prohíbe verter, sin tratamiento, residuos sólidos, líquidos o gaseosos que puedan contaminar o eutroficar las aguas o poner en peligro la salud humana o el normal desarrollo de la flora o fauna.",
            "Se prohíbe verter al suelo sustancias que contengan contaminantes orgánicos persistentes de los que trata el Convenio de Estocolmo.",
          ]),
          p("obligaciones_permisionario", "Obligaciones del permisionario", {
            plantilla:
              "La expedición del presente concepto no exime al usuario, {solicitante}, identificado(a) con {identificacion}, del cumplimiento de los requisitos establecidos por el Ministerio de Ambiente y Desarrollo Sostenible, Decreto 1076 de 2015, ni de la normatividad emitida por la CDMB.",
          }),
          p("recomendaciones", "Recomendaciones"),
          p("informe_visita", "Informe de la visita de inspección ocular", { obligatorio: true }),
          sel("viabilidad", "Concepto", ["VIABLE OTORGAR", "NO VIABLE OTORGAR", "REQUIERE INFORMACIÓN ADICIONAL"], { obligatorio: true }),
          p("concepto_tecnico", "Concepto técnico", {
            obligatorio: true,
            plantilla:
              "De conformidad con los estudios e información presentada ante la CDMB, según el Decreto 1076 de 2015, título 3, capítulo 3, se considera {viabilidad} el permiso de vertimientos de aguas residuales domésticas (ARD) a {solicitante}, identificado(a) con {identificacion}, para el proyecto {nombre_proyecto}.",
          }),
        ],
      },
    ],
  },
};

function formatoDeVisita(seccionesEspecificas: EstructuraFormato["secciones"]): EstructuraFormato {
  return {
    secciones: [
      {
        id: "datos_generales",
        titulo: "Datos generales",
        campos: [...datosSolicitante, p("nombre_proyecto", "Nombre del proyecto, obra o actividad", { obligatorio: true }), ...datosVisita],
      },
      {
        id: "ubicacion",
        titulo: "1. Ubicación",
        campos: [
          t("municipio", "Municipio", { precarga: "municipio", obligatorio: true }),
          t("vereda", "Vereda", { zona: "vereda", desde: "coordenadas" }),
          t("predio", "Nombre del predio", { precarga: "predio" }),
          t("direccion_predio", "Dirección del predio", { precarga: "direccion_predio" }),
          t("matricula", "Matrículas inmobiliarias", { precarga: "matricula", multiple: true }),
          t("catastral", "No. catastral", { precarga: "catastral" }),
          n("area_predio", "Área del predio", "ha", { precarga: "area_predio" }),
          { id: "coordenadas", etiqueta: "Coordenadas del sitio visitado", tipo: "coordenadas", conCota: true, obligatorio: true },
          p("determinantes_ambientales", "Determinantes ambientales del punto", {
            zona: "resumen_ambiental",
            desde: "coordenadas",
            ayuda: "Se llena con las capas de la jurisdicción al capturar las coordenadas; puede ajustarse.",
          }),
          p("uso_suelo", "Uso del suelo según el instrumento de ordenamiento territorial (POT / EOT)"),
        ],
      },
      {
        id: "desarrollo",
        titulo: "2. Desarrollo de la visita",
        campos: [
          p("descripcion_visita", "Descripción de la visita", {
            obligatorio: true,
            plantilla:
              "El día {fecha_visita} se realizó visita técnica de inspección ocular al predio «{predio}», ubicado en el municipio de {municipio}, en compañía de {recibe_visita}, con el fin de verificar en campo la información aportada por {solicitante} dentro del expediente {expediente}.",
          }),
          p("descripcion_actividad", "Descripción del proyecto, obra o actividad observada"),
          {
            id: "aspectos",
            etiqueta: "Aspectos verificados en campo",
            tipo: "tabla",
            columnas: [col("aspecto", "Aspecto verificado"), col("observacion", "Observación"), col("cumplimiento", "Cumplimiento", "cumplimiento")],
          },
          {
            id: "puntos",
            etiqueta: "Puntos georreferenciados",
            tipo: "tabla",
            columnas: [
              col("punto", "Punto"),
              col("norte", "Norte", "numero", { decimales: 0 }),
              col("este", "Este", "numero", { decimales: 0 }),
              col("cota", "Cota (m s. n. m.)", "numero", { decimales: 0 }),
              col("descripcion", "Descripción"),
            ],
          },
        ],
      },
      ...seccionesEspecificas,
      {
        id: "evaluacion",
        titulo: "Evaluación ambiental",
        campos: [p("impactos", "Impactos ambientales identificados"), p("medidas_manejo", "Medidas de manejo, prevención o compensación")],
      },
      {
        id: "concepto",
        titulo: "Concepto técnico",
        campos: [
          sel("viabilidad", "Concepto", ["VIABLE", "NO VIABLE", "REQUIERE INFORMACIÓN ADICIONAL"], { obligatorio: true }),
          p("concepto_tecnico", "Concepto técnico", {
            obligatorio: true,
            plantilla:
              "De acuerdo con la visita técnica realizada el día {fecha_visita} y la documentación presentada por {solicitante}, identificado(a) con {identificacion}, para el proyecto {nombre_proyecto}, ubicado en el predio «{predio}» del municipio de {municipio}, se considera técnicamente {viabilidad} la solicitud.",
          }),
          p("requerimientos", "Requerimientos o información adicional"),
          chequeo("obligaciones", "Obligaciones y recomendaciones", [
            "El presente concepto no exime al usuario de tramitar los demás permisos, concesiones o autorizaciones ambientales que se requieran.",
            "Cualquier modificación de las condiciones verificadas en la visita deberá informarse previamente a la CDMB.",
            "La CDMB podrá realizar visitas de seguimiento cuando lo considere necesario.",
            { texto: "Deberá llevar a cabo la inscripción en el Registro Único Ambiental (RUA) conforme a la Resolución 0839 de 2023, dentro de los treinta (30) días calendario siguientes a la notificación." },
            "Se entiende que toda la información y documentación aportada se considera veraz y está amparada por la presunción de la buena fe; quienes la aportan son responsables penal y administrativamente de su veracidad.",
          ]),
        ],
      },
    ],
  };
}

export const FORMATO_GENERICO: FormatoBase = {
  codigo: "VT-GENERICO",
  nombre: "Visita técnica (genérico)",
  titulo: "CONCEPTO TÉCNICO DE VISITA",
  version: "1",
  fechaFormato: "",
  tramites: [],
  porDefecto: true,
  estructura: formatoDeVisita([]),
};

export const FORMATO_HIDRICO: FormatoBase = {
  codigo: "VT-HIDRICO",
  nombre: "Visita técnica — recurso hídrico",
  titulo: "CONCEPTO TÉCNICO DE VISITA — RECURSO HÍDRICO",
  version: "1",
  fechaFormato: "",
  tramites: ["M-DA-PR33", "M-DA-PR36", "M-DA-PR39", "M-DA-PR66", "M-DA-PR67"],
  estructura: formatoDeVisita([
    {
      id: "recurso_hidrico",
      titulo: "3. Recurso hídrico",
      campos: [
        t("fuente_hidrica", "Fuente o cuerpo de agua", { obligatorio: true }),
        sel("tipo_fuente", "Tipo de fuente", ["Río", "Quebrada", "Caño", "Nacimiento", "Manantial", "Acuífero (agua subterránea)", "Lago o laguna", "Alcantarillado", "Otro"]),
        t("cuenca", "Cuenca / subzona hidrográfica", { zona: "subzona_hidrografica", desde: "coord_punto" }),
        t("microcuenca", "Microcuenca"),
        { id: "coord_punto", etiqueta: "Coordenadas del punto de interés (captación, ocupación, pozo o descarga)", tipo: "coordenadas", conCota: true, obligatorio: true },
        n("caudal_aforado", "Caudal aforado", "l/s", { decimales: 3 }),
        sel("metodo_aforo", "Método de aforo", ["Volumétrico", "Flotador", "Molinete o correntómetro", "Vertedero", "No se realizó"]),
        p("condiciones_cauce", "Condiciones del cauce, ronda hídrica y cobertura vegetal"),
        p("obras_hidraulicas", "Obras hidráulicas existentes o proyectadas"),
        {
          id: "usuarios_fuente",
          etiqueta: "Usuarios de la misma fuente",
          tipo: "tabla",
          columnas: [col("nombre", "Nombre"), col("expediente", "Expediente"), col("uso", "Uso"), col("cota", "Cota", "numero", { decimales: 0 })],
        },
      ],
    },
  ]),
};

export const FORMATO_FLORA: FormatoBase = {
  codigo: "VT-FLORA",
  nombre: "Visita técnica — flora y productos forestales",
  titulo: "CONCEPTO TÉCNICO DE VISITA — FLORA Y PRODUCTOS FORESTALES",
  version: "1",
  fechaFormato: "",
  tramites: ["M-DA-PR58", "M-DA-PR69", "M-DA-PR70"],
  estructura: formatoDeVisita([
    {
      id: "verificacion_forestal",
      titulo: "3. Verificación forestal",
      campos: [
        {
          id: "especies",
          etiqueta: "Especies y productos verificados",
          tipo: "tabla",
          obligatorio: true,
          columnas: [
            col("nombre_comun", "Nombre común"),
            col("nombre_cientifico", "Nombre científico"),
            col("cantidad", "Cantidad", "numero", { decimales: 0, total: true }),
            col("unidad", "Unidad"),
            col("volumen", "Volumen (m³)", "numero", { decimales: 2, total: true }),
            col("observacion", "Observación"),
          ],
          agrupar: { por: ["nombre_comun", "nombre_cientifico"], sumar: ["cantidad", "volumen"], titulo: "Resumen por especie" },
        },
        calc("volumen_total", "Volumen total verificado", "especies.volumen", 2, "m³"),
        n("area_verificada", "Área de la plantación o del aprovechamiento", "ha", { decimales: 2 }),
        sel("estado_sanitario", "Estado fitosanitario", ["Bueno", "Regular", "Malo", "No aplica"]),
        t("cobertura_corine", "Tipo de cobertura (CORINE Land Cover)"),
        p("procedencia_legal", "Procedencia legal de los productos (salvoconductos, actos administrativos, registro)"),
        sn("coincide_documentacion", "¿Lo verificado coincide con la documentación aportada?"),
      ],
    },
  ]),
};

export const FORMATOS_BASE: FormatoBase[] = [FORMATO_FORESTAL, FORMATO_AGUAS, FORMATO_VERTIMIENTOS, FORMATO_HIDRICO, FORMATO_FLORA, FORMATO_GENERICO];
