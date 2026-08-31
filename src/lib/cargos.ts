/**
 * Catálogo de cargos reales de la CDMB, deducido de los "responsables" de las
 * 292 actividades de los 30 procedimientos (240 variantes de texto distintas
 * para ~16 cargos reales — cada PDF los escribió un poco distinto: "Subdirector
 * de SEYCA" / "Subdirector SEYCA" / "Subdirectora de SEYCA" son el mismo cargo).
 *
 * `palabrasClave` cumple doble función: (1) resalta en el seguimiento de un
 * expediente cuándo un paso probablemente le corresponde al usuario que tiene
 * la sesión abierta (`cargoCoincideConPaso`, solo visual), y (2) desde que
 * existe `puedeGestionarPaso` (ver abajo), es también la fuente de verdad del
 * bloqueo real: si el texto de `responsables` de un paso reconoce uno o más
 * cargos de este catálogo, solo alguien con ese cargo (o el ADMIN) puede
 * avanzarlo. Por eso las palabras clave deben ser lo bastante específicas
 * para no cruzarse entre cargos — una palabra clave genérica (p. ej. un
 * "coordinador" sin calificar) no solo resaltaría mal, bloquearía mal: le
 * daría acceso real a un paso de OTRO coordinador. Ver el caso ya corregido
 * de "Coordinador(a) de Evaluación" más abajo.
 */
export const CARGOS_CDMB: { nombre: string; palabrasClave: string[] }[] = [
  { nombre: "Director(a) General", palabrasClave: ["director general", "directora general", "dirección general"] },
  {
    // "asesor de la dirección general" (con "la" en medio) NO contiene "asesor de
    // dirección" — sin esta clave el texto caía SOLO en "Director General" (por
    // "dirección general"), un cargo distinto. En la práctica todo paso que menciona
    // al Asesor menciona también al Director aparte, así que el solape residual con
    // "Director General" es inocuo.
    nombre: "Asesor(a) de Dirección General",
    palabrasClave: ["asesor de dirección", "asesora de dirección", "asesor de la dirección", "asesora de la dirección", "asesor de despacho"],
  },
  {
    // Se quitó la clave suelta "seyca": marcaba como Subdirector cualquier texto que
    // solo nombra el ÁREA ("Secretaria de SEYCA", "Profesional de SEYCA", "Equipo
    // profesional ... – SEYCA"). Todo paso en que interviene el Subdirector real lo
    // escribe como "Subdirector(a) ... " (de SEYCA / de Evaluación y Control
    // Ambiental / del proceso de SEYCA), así que "subdirector"/"subdirectora" basta.
    nombre: "Subdirector(a) de Evaluación y Control Ambiental (SEYCA)",
    palabrasClave: ["subdirector", "subdirectora"],
  },
  { nombre: "Secretario(a) General", palabrasClave: ["secretario general", "secretaria general", "secretaría general"] },
  {
    // "coordinador"/"coordinadora"/"coordinación" a secas — sin calificar — se
    // quitaron a propósito: coincidían también con textos que hablan del OTRO
    // coordinador ("Coordinador de Seguimiento para la Sostenibilidad"), lo
    // que le daba acceso real a pasos que no le corresponden (bug encontrado
    // auditando los 30 PDF paso por paso tras activar el bloqueo real).
    nombre: "Coordinador(a) de Evaluación para la Sostenibilidad",
    palabrasClave: [
      "evaluación para la sostenibilidad",
      "evaluación ambiental",
      "grupo de evaluación",
      "coordinación de evaluación",
      "coordinador responsable del área de evaluación",
    ],
  },
  {
    nombre: "Coordinador(a) de Seguimiento para la Sostenibilidad",
    palabrasClave: [
      "seguimiento para la sostenibilidad",
      "grupo de seguimiento",
      "coordinación de seguimiento",
      "coordinador de seguimiento",
      "control y seguimiento ambiental",
      "seguimiento y control ambiental",
    ],
  },
  { nombre: "Profesional en Derecho / Jurídico", palabrasClave: ["profesional en derecho", "jurídic", "judicante"] },
  {
    nombre: "Profesional o Técnico de Evaluación",
    palabrasClave: [
      "profesional técnico",
      "técnico responsable",
      "servidor técnico",
      "profesional o técnico",
      "técnico adscrito",
      "técnico asignado",
      "área de evaluación",
      "de la subdirección de evaluación",
      "adscrito a seyca",
      "profesionales designados",
      "profesional designado",
    ],
  },
  {
    nombre: "Servidor(a) de Ventanilla de Trámites Ambientales",
    palabrasClave: ["ventanilla"],
  },
  { nombre: "Servidor(a) de Correspondencia", palabrasClave: ["correspondencia", "canales de atención"] },
  // "notific" (no "notificaci") para cubrir tanto "notificación/notificaciones" como
  // el verbo "notificar" — con solo "notificaci" se perdían los pasos redactados como
  // "Servidor responsable de notificar" (encontrado en la misma auditoría).
  { nombre: "Servidor(a) de Notificaciones", palabrasClave: ["notific"] },
  { nombre: "Servidor(a) de Gestión Documental", palabrasClave: ["gestión documental", "publicación"] },
  { nombre: "Servidor(a) de Facturación / Tesorería", palabrasClave: ["facturación", "tesorería", "liquidación"] },
  { nombre: "Secretaria(o) de Despacho / Apoyo administrativo", palabrasClave: ["secretaria de", "secretaria del despacho"] },
  { nombre: "Contratista de apoyo técnico o jurídico", palabrasClave: ["contratista"] },
  { nombre: "Otro / sin cargo específico", palabrasClave: [] },
];

export function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // quita tildes (marcas combinantes) para comparar sin depender de acentos exactos
}

/** ¿El cargo del usuario aparece mencionado (por palabra clave) en el texto de responsables de un paso? */
export function cargoCoincideConPaso(nombreCargo: string | null | undefined, responsables: string[]) {
  if (!nombreCargo) return false;
  const cargo = CARGOS_CDMB.find((c) => c.nombre === nombreCargo);
  if (!cargo || cargo.palabrasClave.length === 0) return false;
  const textoResponsables = normalizar(responsables.join(" | "));
  return cargo.palabrasClave.some((palabra) => textoResponsables.includes(normalizar(palabra)));
}

/**
 * Un mismo cargo aparece escrito distinto en cada PDF ("Coordinador de
 * Evaluación" / "Coordinador responsable del área de Evaluación" / ...).
 * Esto agrupa un texto de responsable tal como viene del PDF bajo su cargo
 * canónico de CARGOS_CDMB, para poder mostrar "quiénes intervienen" sin
 * repetir la misma persona con 5 redacciones distintas. Si no coincide con
 * ningún cargo conocido, devuelve el texto original tal cual (no se pierde
 * información, solo no se agrupa).
 */
export function cargoCanonico(textoResponsable: string): string {
  const texto = normalizar(textoResponsable);
  for (const cargo of CARGOS_CDMB) {
    if (cargo.palabrasClave.some((p) => texto.includes(normalizar(p)))) {
      return cargo.nombre;
    }
  }
  return textoResponsable.trim();
}

/**
 * A diferencia de cargoCanonico() (un texto corto = un cargo), esto revisa
 * un párrafo largo tipo `autoridadResponsabilidad` ("El Subdirector... y el
 * Coordinador... tienen la autoridad... Los servidores adscritos... serán
 * responsables...") y devuelve TODOS los cargos del catálogo que aparecen
 * mencionados — para mostrar el/los cargo(s) puntual(es) en vez del párrafo
 * legal completo. Si el párrafo no menciona ningún cargo reconocible,
 * devuelve una lista vacía (no un texto de respaldo: aquí sí puede pasar,
 * y no tiene sentido "inventar" un cargo).
 */
export function cargosEnTexto(texto: string): string[] {
  const normalizado = normalizar(texto);
  const encontrados: string[] = [];
  for (const cargo of CARGOS_CDMB) {
    if (cargo.palabrasClave.length === 0) continue;
    if (cargo.palabrasClave.some((p) => normalizado.includes(normalizar(p)))) {
      encontrados.push(cargo.nombre);
    }
  }
  return encontrados;
}

/**
 * ¿Puede este usuario avanzar/completar el paso actual (marcarlo hecho, tomar la
 * decisión que lo mueve al siguiente)? Esta es la única restricción de acceso real
 * sobre pasos — a diferencia de `cargoCoincideConPaso` (que es solo el resaltado
 * visual "esto le toca a su cargo"), esta función decide si el botón de avanzar
 * queda habilitado o bloqueado:
 *
 * - ADMIN: siempre puede, sin importar su cargo (control total de respaldo).
 * - Si el texto de `responsables` del paso no menciona ningún cargo del catálogo
 *   (redacción del PDF demasiado genérica o inusual), NO se restringe a nadie —
 *   bloquear sin poder identificar con certeza a quién le corresponde dejaría el
 *   trámite sin nadie que pueda avanzarlo.
 * - Si sí se reconoce uno o más cargos, solo un funcionario con alguno de esos
 *   cargos asignados puede avanzar el paso.
 */
export function puedeGestionarPaso(
  session: { rol: "ADMIN" | "FUNCIONARIO"; cargo: string | null } | null | undefined,
  responsables: string[]
): boolean {
  if (!session) return false;
  if (session.rol === "ADMIN") return true;
  const cargosDelPaso = cargosEnTexto(responsables.join(" | "));
  if (cargosDelPaso.length === 0) return true;
  return session.cargo != null && cargosDelPaso.includes(session.cargo);
}

/** Cargos canónicos únicos mencionados en cualquier paso de una lista de flujos. */
export function cargosQueIntervienen(flujos: { pasos: { responsables: string[] }[] }[]): string[] {
  const vistos = new Set<string>();
  for (const flujo of flujos) {
    for (const paso of flujo.pasos) {
      for (const r of paso.responsables) {
        vistos.add(cargoCanonico(r));
      }
    }
  }
  return Array.from(vistos);
}
