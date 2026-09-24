export const CARGOS_CDMB: { nombre: string; palabrasClave: string[] }[] = [
  { nombre: "Director(a) General", palabrasClave: ["director general", "directora general", "dirección general"] },
  {
    nombre: "Asesor(a) de Dirección General",
    palabrasClave: ["asesor de dirección", "asesora de dirección", "asesor de la dirección", "asesora de la dirección", "asesor de despacho"],
  },
  {
    nombre: "Subdirector(a) de Evaluación y Control Ambiental (SEYCA)",
    palabrasClave: ["subdirector", "subdirectora"],
  },
  { nombre: "Secretario(a) General", palabrasClave: ["secretario general", "secretaria general", "secretaría general"] },
  {
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
  { nombre: "Servidor(a) de Notificaciones", palabrasClave: ["notific"] },
  { nombre: "Servidor(a) de Gestión Documental", palabrasClave: ["gestión documental", "publicación"] },
  { nombre: "Servidor(a) de Facturación / Tesorería", palabrasClave: ["facturación", "tesorería", "liquidación"] },
  { nombre: "Secretaria(o) de Despacho / Apoyo administrativo", palabrasClave: ["secretaria de", "secretaria del despacho"] },
  { nombre: "Contratista de apoyo técnico o jurídico", palabrasClave: ["contratista"] },
  { nombre: "Otro / sin cargo específico", palabrasClave: [] },
];

export function cargoParaSexo(nombre: string, sexo: string | null | undefined): string {
  const f = sexo === "F";
  return nombre
    .replace(/a\(o\)/g, f ? "a" : "o")
    .replace(/\(a\)/g, f ? "a" : "")
    .replace(/\(o\)/g, f ? "" : "o")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function cargoCoincideConPaso(cargosUsuario: string[] | null | undefined, responsables: string[]) {
  if (!cargosUsuario || cargosUsuario.length === 0) return false;
  const textoResponsables = normalizar(responsables.join(" | "));
  return cargosUsuario.some((nombreCargo) => {
    const cargo = CARGOS_CDMB.find((c) => c.nombre === nombreCargo);
    if (!cargo || cargo.palabrasClave.length === 0) return false;
    return cargo.palabrasClave.some((palabra) => textoResponsables.includes(normalizar(palabra)));
  });
}

export function cargoCanonico(textoResponsable: string): string {
  const texto = normalizar(textoResponsable);
  for (const cargo of CARGOS_CDMB) {
    if (cargo.palabrasClave.some((p) => texto.includes(normalizar(p)))) {
      return cargo.nombre;
    }
  }
  return textoResponsable.trim();
}

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

export function puedeGestionarPaso(
  session: { rol: "ADMIN" | "FUNCIONARIO"; cargos: string[] } | null | undefined,
  responsables: string[]
): boolean {
  if (!session) return false;
  if (session.rol === "ADMIN") return true;
  const cargosDelPaso = cargosEnTexto(responsables.join(" | "));
  if (cargosDelPaso.length === 0) return true;
  return session.cargos.some((c) => cargosDelPaso.includes(c));
}

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
