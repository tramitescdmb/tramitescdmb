import type { TipoComunicacion } from "@prisma/client";

/**
 * Flujos de trabajo precargados (MoReq 7.17: flujos basados en plantillas). Son
 * datos puros — no tocan la base. `cargarPlantillasFlujo()` en `flujos.ts` los
 * inserta como `FlujoTrabajo` reales que el administrador puede después editar,
 * activar o borrar como cualquier otro. Cada `clave` de paso solo sirve para
 * enlazar las transiciones dentro de la misma plantilla.
 */

export type TipoPasoPlantilla = "TAREA" | "REVISION" | "DECISION" | "FIN";
export type AsignacionPlantilla =
  | "DEPENDENCIA_COMUNICACION"
  | "DEPENDENCIA_FIJA"
  | "CARGO"
  | "RADICADOR"
  | "RESPONSABLE_PASO_ANTERIOR"
  | "MANUAL";

export type PasoPlantilla = {
  clave: string;
  nombre: string;
  tipo: TipoPasoPlantilla;
  asignacion: AsignacionPlantilla;
  slaDiasHabiles?: number;
  instrucciones?: string;
  /** Salidas del paso. Un paso que no sea FIN debe tener al menos una. */
  transiciones?: { etiqueta: string; hacia: string }[];
};

export type PlantillaFlujo = {
  nombre: string;
  descripcion: string;
  aplicaA: TipoComunicacion | null;
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
    descripcion: "Redacción del oficio en la dependencia productora, revisión/firma y despacho. Devuelve al redactor si la revisión no aprueba.",
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
        nombre: "Revisión y firma",
        tipo: "REVISION",
        asignacion: "DEPENDENCIA_COMUNICACION",
        slaDiasHabiles: 2,
        instrucciones: "Revise el contenido y la forma. Firme y despache o devuelva con observaciones.",
        transiciones: [
          { etiqueta: "Firmar y despachar", hacia: "despacho" },
          { etiqueta: "Devolver", hacia: "redaccion" },
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
];

/** Problemas estructurales de un flujo (para avisar en la interfaz antes de activarlo). */
export type ProblemaFlujo = { paso?: string; mensaje: string };

export function validarEstructuraFlujo(pasos: {
  id: string;
  nombre: string;
  tipo: string;
  orden: number;
  transiciones: { haciaPasoId: string }[];
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
  }

  // Alcanzabilidad del cierre desde el paso inicial.
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
