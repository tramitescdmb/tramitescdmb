export const TEMAS_VISITA_BASE: { nombre: string; codigos: string[] }[] = [
  { nombre: "Inspección ocular del predio o sitio del proyecto", codigos: [] },
  { nombre: "Georreferenciación del predio y de los puntos de interés", codigos: [] },
  { nombre: "Verificación de la información presentada por el solicitante", codigos: [] },
  { nombre: "Compatibilidad con instrumentos de planificación (POT, POMCA, POF)", codigos: ["M-DA-PR41", "M-DA-PR70", "M-DA-PR22", "M-DA-PR65"] },
  { nombre: "Estado de la cobertura vegetal y de conservación forestal", codigos: ["M-DA-PR21", "M-DA-PR41", "M-DA-PR70"] },
  { nombre: "Captación: georreferenciación y aforo", codigos: ["M-DA-PR21", "M-DA-PR66", "M-DA-PR67"] },
  { nombre: "Usuarios aguas arriba y aguas abajo y conflictos por el uso del agua", codigos: ["M-DA-PR21", "M-DA-PR67"] },
  { nombre: "Conducción, almacenamiento y distribución del agua (uso eficiente)", codigos: ["M-DA-PR21", "M-DA-PR66"] },
  { nombre: "Características hidrogeológicas, pozo y prueba de bombeo", codigos: ["M-DA-PR21", "M-DA-PR33"] },
  { nombre: "Puntos de vertimiento y sistema de tratamiento", codigos: ["M-DA-PR05", "M-DA-PR36", "M-DA-PR66"] },
  { nombre: "Fuente hídrica y obra de ocupación de cauce", codigos: ["M-DA-PR39"] },
  { nombre: "Fuentes fijas de emisión y sistemas de control", codigos: ["M-DA-PR07"] },
  { nombre: "Equipos de medición de gases y cumplimiento de las NTC", codigos: ["M-DA-PR09"] },
  { nombre: "Inventario forestal: especies y número de individuos", codigos: ["M-DA-PR41", "M-DA-PR69", "M-DA-PR70"] },
  { nombre: "Estado fitosanitario y riesgo de los árboles", codigos: ["M-DA-PR48"] },
  { nombre: "Especies y cantidades a movilizar", codigos: ["M-DA-PR16", "M-DA-PR58"] },
  { nombre: "Fauna silvestre: área y especies objeto de la solicitud", codigos: ["M-DA-PR34", "M-DA-PR71"] },
  { nombre: "Programa de manejo ambiental de RCD", codigos: ["M-DA-PR60"] },
  { nombre: "Equipos, residuos o desechos con PCB", codigos: ["M-DA-PR35"] },
  { nombre: "Instalaciones de desintegración vehicular y manejo de residuos", codigos: ["M-DA-PR64"] },
  { nombre: "Área de explotación minera y medidas de manejo", codigos: ["M-DA-PR65"] },
  { nombre: "Verificación in situ del Estudio de Impacto Ambiental", codigos: ["M-DA-PR22", "M-DA-PR55", "M-DA-PR65"] },
  { nombre: "Departamento de Gestión Ambiental de la empresa", codigos: ["M-DA-PR29"] },
];

export const ETIQUETA_RESULTADO_VISITA: Record<string, string> = {
  VIABLE: "Sin observaciones / viable",
  REQUIERE_INFORMACION: "Requiere información adicional",
  NO_VIABLE: "No viable",
  EN_ANALISIS: "Pendiente de análisis en oficina",
};

export const CLASE_RESULTADO_VISITA: Record<string, string> = {
  VIABLE: "bg-emerald-50 text-emerald-700",
  REQUIERE_INFORMACION: "bg-amber-50 text-amber-800",
  NO_VIABLE: "bg-red-50 text-red-700",
  EN_ANALISIS: "bg-sky-50 text-sky-700",
};

export function codigoProcedimiento(codigoTramite: string): string {
  const m = /M-DA-PR\d+/i.exec(codigoTramite);
  return m ? m[0].toUpperCase() : codigoTramite.toUpperCase();
}

export function ordenarTemasParaTramite<T extends { nombre: string; codigosTramite: string[] }>(
  temas: T[],
  codigoTramite: string
): { sugeridos: T[]; otros: T[] } {
  const codigo = codigoProcedimiento(codigoTramite);
  const sugeridos = temas.filter((t) => t.codigosTramite.includes(codigo) || t.codigosTramite.length === 0);
  const otros = temas.filter((t) => !sugeridos.includes(t));
  const porNombre = (a: T, b: T) => a.nombre.localeCompare(b.nombre, "es");
  return {
    sugeridos: [...sugeridos.filter((t) => t.codigosTramite.length > 0).sort(porNombre), ...sugeridos.filter((t) => t.codigosTramite.length === 0)],
    otros: otros.sort(porNombre),
  };
}

export function normalizarNombreTema(nombre: string): string {
  const limpio = nombre.trim().replace(/\s+/g, " ");
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

export function esPasoDeVisita(titulo: string): boolean {
  return /visita/i.test(titulo) && !/programar/i.test(titulo) && !/asignar/i.test(titulo);
}

export function esPasoDeProgramarVisita(titulo: string): boolean {
  return /visita/i.test(titulo) && /(programar|asignar)/i.test(titulo);
}

export function pasoPermiteVisita(titulo: string, descripcion?: string | null): boolean {
  if (esPasoDeVisita(titulo) || esPasoDeProgramarVisita(titulo)) return true;
  const d = (descripcion ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return /realizara visitas? de verificacion|se procede a programar la visita|para programacion de visita/.test(d);
}

export type EstadoPasoVisita = { permite: boolean; motivo: string | null };

export function evaluarPasoParaVisita(
  pasos: { numero: number; titulo: string; descripcion?: string | null }[],
  pasoActualNumero: number
): EstadoPasoVisita {
  const actual = pasos.find((p) => p.numero === pasoActualNumero);
  if (actual && pasoPermiteVisita(actual.titulo, actual.descripcion)) return { permite: true, motivo: null };
  const pasosVisita = pasos.filter((p) => pasoPermiteVisita(p.titulo, p.descripcion));
  const donde = actual ? `El trámite está en el paso ${actual.numero} (${actual.titulo.toLowerCase()}).` : "El trámite no tiene un paso activo.";
  if (pasosVisita.length === 0) return { permite: false, motivo: `${donde} Su procedimiento no contempla visitas técnicas.` };
  const lista = pasosVisita.map((p) => `${p.numero} (${p.titulo.toLowerCase()})`).join(" o ");
  return { permite: false, motivo: `${donde} Las visitas solo se programan cuando está en el paso ${lista}.` };
}

export function visitaHabilitadaParaRegistro(diaProgramado: string, hoy: string): boolean {
  return diaProgramado <= hoy;
}

export function documentoCubiertoPorVisita(nombreDocumento: string, visita: { conFotos: boolean }): boolean {
  const n = nombreDocumento.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/registro fotografico|fotografias/.test(n)) return visita.conFotos;
  return /(hoja|acta|cartera|registro) de (la )?visita|visita de inspeccion|hoja de visita|acta de visita|coordenadas/.test(n);
}
