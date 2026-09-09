/**
 * Cálculo de días hábiles y festivos de Colombia (Ley 51 de 1983 — Ley Emiliani),
 * para los términos legales de respuesta (Ley 1437/2011 · CPACA) del SGDEA.
 *
 * Puro y sin dependencias (no hay librería de fechas en el proyecto). Trabaja en
 * UTC sobre fechas-solo-día para no depender de zona horaria (Colombia es UTC-5
 * fijo, sin horario de verano). Los festivos de ley se calculan; los días
 * compensados/cierres de la entidad y la jornada semanal se pasan como
 * `CalendarioLaboral` (se cargan de base en src/lib/calendario-laboral.ts).
 */

/**
 * Ajustes de la entidad al calendario: días extra que NO se laboran (además de
 * los festivos de ley) y qué días de la semana SÍ son laborables
 * (getUTCDay: 0=domingo … 6=sábado; por defecto lunes a viernes).
 */
export type CalendarioLaboral = {
  diasNoLaborables?: Set<string>; // YYYY-MM-DD adicionales
  diasSemana?: number[]; // días de la semana laborables; vacío/ausente = [1..5]
};

const DIAS_SEMANA_DEFECTO = [1, 2, 3, 4, 5];

function iso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function fechaUTC(anio: number, mesBase0: number, dia: number): Date {
  return new Date(Date.UTC(anio, mesBase0, dia));
}

/** Domingo de Pascua (algoritmo de Computus, gregoriano anónimo). */
function domingoPascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return fechaUTC(anio, mes - 1, dia);
}

function sumarDias(fecha: Date, n: number): Date {
  return new Date(fecha.getTime() + n * 86_400_000);
}

/** Traslada un festivo al lunes siguiente (regla Emiliani), salvo que ya sea lunes. */
function lunesSiguiente(fecha: Date): Date {
  const dow = fecha.getUTCDay(); // 0 = domingo, 1 = lunes
  if (dow === 1) return fecha;
  const dias = dow === 0 ? 1 : 8 - dow;
  return sumarDias(fecha, dias);
}

/** Conjunto de festivos (YYYY-MM-DD) de Colombia para un año. */
export function festivosColombia(anio: number): Set<string> {
  const fijos = [
    fechaUTC(anio, 0, 1), // Año Nuevo
    fechaUTC(anio, 4, 1), // Día del Trabajo
    fechaUTC(anio, 6, 20), // Independencia
    fechaUTC(anio, 7, 7), // Batalla de Boyacá
    fechaUTC(anio, 11, 8), // Inmaculada Concepción
    fechaUTC(anio, 11, 25), // Navidad
  ];
  // Emiliani: se trasladan al lunes siguiente.
  const emiliani = [
    fechaUTC(anio, 0, 6), // Reyes Magos
    fechaUTC(anio, 2, 19), // San José
    fechaUTC(anio, 5, 29), // San Pedro y San Pablo
    fechaUTC(anio, 7, 15), // Asunción de la Virgen
    fechaUTC(anio, 9, 12), // Día de la Raza
    fechaUTC(anio, 10, 1), // Todos los Santos
    fechaUTC(anio, 10, 11), // Independencia de Cartagena
  ].map(lunesSiguiente);

  const pascua = domingoPascua(anio);
  const juevesSanto = sumarDias(pascua, -3);
  const viernesSanto = sumarDias(pascua, -2);
  // Ascensión (+43), Corpus Christi (+64), Sagrado Corazón (+71): trasladados a lunes.
  const ascension = lunesSiguiente(sumarDias(pascua, 43));
  const corpus = lunesSiguiente(sumarDias(pascua, 64));
  const sagradoCorazon = lunesSiguiente(sumarDias(pascua, 71));

  const todos = [...fijos, ...emiliani, juevesSanto, viernesSanto, ascension, corpus, sagradoCorazon];
  return new Set(todos.map(iso));
}

export function esFinDeSemana(fecha: Date): boolean {
  const dow = fecha.getUTCDay();
  return dow === 0 || dow === 6;
}

export function esFestivo(fecha: Date): boolean {
  return festivosColombia(fecha.getUTCFullYear()).has(iso(fecha));
}

/** Un día es hábil si: es un día laborable de la semana de la entidad, no es festivo de ley, y no es un día no laborado configurado. */
export function esDiaHabil(fecha: Date, cal?: CalendarioLaboral): boolean {
  const laborables = cal?.diasSemana?.length ? cal.diasSemana : DIAS_SEMANA_DEFECTO;
  if (!laborables.includes(fecha.getUTCDay())) return false;
  if (esFestivo(fecha)) return false;
  if (cal?.diasNoLaborables?.has(iso(fecha))) return false;
  return true;
}

/**
 * Suma `n` días HÁBILES a una fecha (para calcular el vencimiento de un término).
 * El día de partida no cuenta; se avanza hasta acumular `n` días hábiles. Devuelve
 * una fecha-solo-día en UTC.
 */
export function sumarDiasHabiles(desde: Date, n: number, cal?: CalendarioLaboral): Date {
  let cursor = fechaUTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate());
  let restantes = n;
  while (restantes > 0) {
    cursor = sumarDias(cursor, 1);
    if (esDiaHabil(cursor, cal)) restantes--;
  }
  return cursor;
}

/** Días hábiles entre dos fechas (excluye la de inicio, incluye la final si es hábil). */
export function diasHabilesEntre(inicio: Date, fin: Date, cal?: CalendarioLaboral): number {
  if (fin <= inicio) return 0;
  let cursor = fechaUTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
  const objetivo = iso(fechaUTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate()));
  let contador = 0;
  while (iso(cursor) !== objetivo) {
    cursor = sumarDias(cursor, 1);
    if (esDiaHabil(cursor, cal)) contador++;
  }
  return contador;
}
