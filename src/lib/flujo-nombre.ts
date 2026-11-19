/**
 * Nombre de una modalidad (flujo) de trámite para mostrar. Los nombres vienen de
 * los procedimientos escritos («INSTRUCCIONES INICIO TRÁMITE», «INSTRUCCIONES
 * RENOVACIÓN DE PERMISO DE VERTIMIENTO»…): se quita «Instrucciones», se pasa a
 * mayúscula inicial y el inicio se llama «Solicitud nueva».
 */
const SIGLAS = new Set(["acu", "rcd", "psmv", "sun", "pcb", "anla", "cda", "rurh", "respel"]);

export function nombreFlujo(nombre: string | null | undefined): string {
  let t = (nombre ?? "").trim().replace(/^instrucciones(\s+para(\s+la|\s+el)?)?\s*/i, "").trim();
  if (!t || /^inicio( del?)? tr[aá]mite$/i.test(t)) return "Solicitud nueva";
  if (t === t.toUpperCase()) {
    t = t
      .toLowerCase()
      .split(/(\s+|[–-])/)
      .map((p) => (SIGLAS.has(p.replace(/[^a-záéíóúñ]/g, "")) ? p.toUpperCase() : p))
      .join("");
    t = t.charAt(0).toUpperCase() + t.slice(1);
    t = t.replace(/único nacional/g, "Único Nacional");
  }
  return t;
}
