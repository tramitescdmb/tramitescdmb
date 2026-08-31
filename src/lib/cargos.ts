/**
 * Catálogo de cargos reales de la CDMB, deducido de los "responsables" de las
 * 292 actividades de los 30 procedimientos (240 variantes de texto distintas
 * para ~16 cargos reales — cada PDF los escribió un poco distinto: "Subdirector
 * de SEYCA" / "Subdirector SEYCA" / "Subdirectora de SEYCA" son el mismo cargo).
 *
 * `palabrasClave` sirve para resaltar en el seguimiento de un expediente cuándo
 * un paso probablemente le corresponde al usuario que tiene la sesión abierta
 * (compara su cargo contra el texto de `responsables` del paso). Es una ayuda
 * visual, no una restricción: cualquier funcionario puede seguir gestionando
 * cualquier paso — el texto de los PDFs es demasiado variado para bloquear con
 * certeza total quién puede hacer qué.
 */
export const CARGOS_CDMB: { nombre: string; palabrasClave: string[] }[] = [
  { nombre: "Director(a) General", palabrasClave: ["director general", "dirección general"] },
  { nombre: "Asesor(a) de Dirección General", palabrasClave: ["asesor de dirección", "asesor de despacho"] },
  {
    nombre: "Subdirector(a) de Evaluación y Control Ambiental (SEYCA)",
    palabrasClave: ["subdirector", "subdirectora", "seyca"],
  },
  { nombre: "Secretario(a) General", palabrasClave: ["secretario general", "secretaria general", "secretaría general"] },
  {
    nombre: "Coordinador(a) de Evaluación para la Sostenibilidad",
    palabrasClave: ["coordinador", "coordinadora", "coordinación"].concat(["evaluación para la sostenibilidad", "evaluación ambiental", "grupo de evaluación"]),
  },
  {
    nombre: "Coordinador(a) de Seguimiento para la Sostenibilidad",
    palabrasClave: ["seguimiento para la sostenibilidad", "grupo de seguimiento", "control y seguimiento ambiental"],
  },
  { nombre: "Profesional en Derecho / Jurídico", palabrasClave: ["profesional en derecho", "jurídic", "judicante"] },
  {
    nombre: "Profesional o Técnico de Evaluación",
    palabrasClave: ["profesional técnico", "técnico responsable", "servidor técnico", "profesional o técnico"],
  },
  {
    nombre: "Servidor(a) de Ventanilla de Trámites Ambientales",
    palabrasClave: ["ventanilla"],
  },
  { nombre: "Servidor(a) de Correspondencia", palabrasClave: ["correspondencia", "canales de atención"] },
  { nombre: "Servidor(a) de Notificaciones", palabrasClave: ["notificaci"] },
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
