import { normalizar } from "@/lib/cargos";

/**
 * Documentos que un paso EXIGE antes de dejar avanzar el trámite.
 *
 * El procedimiento oficial (PDF) lista en cada actividad sus «documentos/registros», pero no dice
 * cuáles son obligatorios: allí se mezclan actos que se producen en el paso (auto, resolución,
 * constancia) con registros que no se suben (aplicativo SINCA, el propio expediente) y documentos
 * condicionales (oficio de información adicional, que solo se emite si falta algo). Por eso la
 * marca de obligatorio se define aquí, por código de procedimiento y número de paso, con los
 * nombres exactos de `documentos` del paso en data/tramites/<código>.json.
 *
 * Un procedimiento que no esté en esta tabla no exige documentos para avanzar (como hasta ahora).
 */
type ReglaPaso = {
  documentos: string[];
  /** Resultados de una decisión que NO exigen estos documentos (p. ej. archivar sin resolución). */
  exceptoResultados?: string[];
};

const PR21: Record<number, ReglaPaso> = {
  // 1. Recibir, revisar y radicar: formulario con anexos, lista de chequeo y pago de la evaluación.
  1: { documentos: ["__FORMULARIO__", "Formato Control de Proceso E-GE-FO02 (lista de chequeo)", "Recibo de Pago"] },
  // 2. Solicitar información adicional: el oficio solo se emite si falta información → no se exige.
  // 3. Elaborar auto de inicio.
  3: { documentos: ["Auto de inicio del trámite administrativo ambiental"] },
  // 4. Notificar el auto y entregar el aviso (el auto ya quedó cargado en el paso 3).
  4: { documentos: ["Aviso"] },
  // 5. Publicar avisos: constancia de fijación y desfijación en la alcaldía o inspección.
  5: { documentos: ["Constancia de publicación del aviso en cartelera"] },
  // 6. Visita técnica y concepto técnico.
  6: {
    documentos: [
      "Formato Cartera de Visita Técnica de Campo de Solicitud de Concesión de Aguas (M-DA-FO12)",
      "Informe Técnico de Concesiones",
    ],
  },
  // 7. Visto bueno: se da sobre el informe del paso 6; no produce un documento nuevo obligatorio.
  // 8. Resolución que otorga o niega (el archivo del trámite se hace con auto, no con resolución).
  8: { documentos: ["Resolución de concesión de agua"], exceptoResultados: ["ARCHIVADO"] },
  // 9. Notificar al usuario.
  9: { documentos: ["Constancia de notificación (Personal y/o Edicto)"] },
  // 10. Incorporar al Registro Único de Usuarios: es un registro en SINCA, no un archivo.
};

const REGLAS: Record<string, Record<number, ReglaPaso>> = {
  "M-DA-PR21": PR21,
};

function clave(texto: string): string {
  return normalizar(texto).trim().replace(/\s+/g, " ");
}

/** Nombres (tal como aparecen en el paso) de los documentos obligatorios de ese paso. */
export function documentosObligatoriosDelPaso(
  codigoTramite: string,
  paso: { numero: number; documentos: string[] },
  resultado?: string | null
): string[] {
  const regla = REGLAS[codigoTramite]?.[paso.numero];
  if (!regla) return [];
  if (resultado && regla.exceptoResultados?.includes(resultado)) return [];
  return paso.documentos.filter((nombre) =>
    regla.documentos.some((r) =>
      r === "__FORMULARIO__" ? /^formulario unico nacional/.test(clave(nombre)) : clave(r) === clave(nombre)
    )
  );
}

/**
 * Obligatorios del paso que aún no tienen archivo cargado en ese paso. Los documentos de la
 * radicación (sin paso) cuentan para el paso 1, y cualquiera de ellos cubre el formulario con
 * sus anexos, porque allí se cargan con el nombre de cada requisito. El concepto técnico que genera
 * la visita del Planeador cubre el informe técnico, y una visita registrada en el paso cubre la
 * cartera/hoja de visita.
 */
export function documentosObligatoriosFaltantes(
  codigoTramite: string,
  paso: { numero: number; documentos: string[] },
  cargados: { pasoNumero: number | null; descripcion: string | null }[],
  resultado?: string | null,
  visitaRegistradaEnPaso = false
): string[] {
  const delPaso = cargados.filter((d) => (d.pasoNumero ?? 1) === paso.numero);
  const enPaso = new Set(delPaso.map((d) => clave(d.descripcion ?? "")));
  const hayRadicacion = paso.numero === 1 && cargados.some((d) => d.pasoNumero === null);
  const hayConcepto = delPaso.some((d) => /^concepto tecnico/.test(clave(d.descripcion ?? "")));
  return documentosObligatoriosDelPaso(codigoTramite, paso, resultado).filter((n) => {
    const k = clave(n);
    if (enPaso.has(k)) return false;
    if (hayRadicacion && /^formulario unico nacional/.test(k)) return false;
    if (hayConcepto && /^informe tecnico/.test(k)) return false;
    if (visitaRegistradaEnPaso && /cartera de visita|hoja de visita|acta de visita/.test(k)) return false;
    return true;
  });
}

/** ¿El procedimiento tiene definidas marcas de obligatorio? (para mostrar la leyenda en pantalla) */
export function procedimientoConObligatorios(codigoTramite: string): boolean {
  return codigoTramite in REGLAS;
}
