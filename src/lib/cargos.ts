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
