export type CalendarioLaboral = {
  diasNoLaborables?: Set<string>;
  diasSemana?: number[];
};

const DIAS_SEMANA_DEFECTO = [1, 2, 3, 4, 5];

function minutosDeHora(h: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(h);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

export function horasDeJornada(j: {
  inicio: string;
  fin: string;
  inicioTarde?: string | null;
  finTarde?: string | null;
}): number {
  const a = minutosDeHora(j.inicio);
  const b = minutosDeHora(j.fin);
  let total = Number.isNaN(a) || Number.isNaN(b) || b <= a ? 0 : b - a;
  if (j.inicioTarde && j.finTarde) {
    const c = minutosDeHora(j.inicioTarde);
    const d = minutosDeHora(j.finTarde);
    if (!Number.isNaN(c) && !Number.isNaN(d) && d > c) total += d - c;
  }
  return Math.round((total / 60) * 100) / 100;
}

function iso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function fechaUTC(anio: number, mesBase0: number, dia: number): Date {
  return new Date(Date.UTC(anio, mesBase0, dia));
}

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
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return fechaUTC(anio, mes - 1, dia);
}

function sumarDias(fecha: Date, n: number): Date {
  return new Date(fecha.getTime() + n * 86_400_000);
}

function lunesSiguiente(fecha: Date): Date {
  const dow = fecha.getUTCDay();
  if (dow === 1) return fecha;
  const dias = dow === 0 ? 1 : 8 - dow;
  return sumarDias(fecha, dias);
}

export function festivosColombia(anio: number): Set<string> {
  const fijos = [
    fechaUTC(anio, 0, 1),
    fechaUTC(anio, 4, 1),
    fechaUTC(anio, 6, 20),
    fechaUTC(anio, 7, 7),
    fechaUTC(anio, 11, 8),
    fechaUTC(anio, 11, 25),
  ];
  const emiliani = [
    fechaUTC(anio, 0, 6),
    fechaUTC(anio, 2, 19),
    fechaUTC(anio, 5, 29),
    fechaUTC(anio, 7, 15),
    fechaUTC(anio, 9, 12),
    fechaUTC(anio, 10, 1),
    fechaUTC(anio, 10, 11),
  ].map(lunesSiguiente);

  const pascua = domingoPascua(anio);
  const juevesSanto = sumarDias(pascua, -3);
  const viernesSanto = sumarDias(pascua, -2);
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

export function esDiaHabil(fecha: Date, cal?: CalendarioLaboral): boolean {
  const laborables = cal?.diasSemana?.length ? cal.diasSemana : DIAS_SEMANA_DEFECTO;
  if (!laborables.includes(fecha.getUTCDay())) return false;
  if (esFestivo(fecha)) return false;
  if (cal?.diasNoLaborables?.has(iso(fecha))) return false;
  return true;
}

export function sumarDiasHabiles(desde: Date, n: number, cal?: CalendarioLaboral): Date {
  let cursor = fechaUTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate());
  let restantes = n;
  while (restantes > 0) {
    cursor = sumarDias(cursor, 1);
    if (esDiaHabil(cursor, cal)) restantes--;
  }
  return cursor;
}

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
