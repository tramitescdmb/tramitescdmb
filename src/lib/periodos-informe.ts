/**
 * Periodos de entrega del informe de supervisión (cuenta de cobro mensual del contratista).
 *
 * Un contratista cobra una vez al mes, así que el informe se entrega por periodos que siguen el
 * mes calendario y se recortan a las fechas del contrato: el primero va desde la fecha de inicio
 * hasta el fin de ese mes, los intermedios son meses completos y el último termina en la fecha de
 * fin. Ej. contrato del 25/09 al 24/12 → 25/09–30/09, 01/10–31/10, 01/11–30/11 y 01/12–24/12.
 * Cada periodo se radica desde el día siguiente a su cierre.
 *
 * Los periodos NO se guardan: se derivan de las fechas del expediente (si estas cambian, los
 * periodos se ajustan solos) y un documento se ata a su mes con la clave "AAAA-MM".
 * Todo el cálculo es en UTC porque las fechas del contrato son fecha-sin-hora (medianoche UTC).
 */

export type PeriodoInforme = {
  /** "AAAA-MM" — identifica el periodo dentro del expediente. */
  clave: string;
  desde: Date;
  hasta: Date;
  /** Primer día en que se puede radicar la cuenta de este periodo (el siguiente al cierre). */
  radicaDesde: Date;
};

const MS_DIA = 24 * 60 * 60 * 1000;

function claveMes(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
}

function inicioDeDia(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

export function calcularPeriodosInforme(fechaInicio: Date | null | undefined, fechaFin: Date | null | undefined): PeriodoInforme[] {
  if (!fechaInicio || !fechaFin) return [];
  const inicio = inicioDeDia(fechaInicio);
  const fin = inicioDeDia(fechaFin);
  if (fin < inicio) return [];

  const periodos: PeriodoInforme[] = [];
  let desde = inicio;
  while (desde <= fin) {
    const finDeMes = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + 1, 0));
    const hasta = finDeMes < fin ? finDeMes : fin;
    periodos.push({ clave: claveMes(desde), desde, hasta, radicaDesde: new Date(hasta.getTime() + MS_DIA) });
    desde = new Date(hasta.getTime() + MS_DIA);
  }
  return periodos;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fechaCorta(fecha: Date, conAnio: boolean): string {
  const base = `${String(fecha.getUTCDate()).padStart(2, "0")} ${MESES[fecha.getUTCMonth()]}`;
  return conAnio ? `${base} ${fecha.getUTCFullYear()}` : base;
}

/** "25 sep – 30 sep 2026" (el año solo se repite si el periodo cruza de un año a otro). */
export function etiquetaRangoPeriodo(periodo: Pick<PeriodoInforme, "desde" | "hasta">): string {
  const cruzaAnio = periodo.desde.getUTCFullYear() !== periodo.hasta.getUTCFullYear();
  return `${fechaCorta(periodo.desde, cruzaAnio)} – ${fechaCorta(periodo.hasta, true)}`;
}

/** Nombre con el que se guarda el documento de un periodo: distingue un informe de otro en el
 * expediente, en las vistas previas y en el ZIP. */
export function nombreDocumentoPeriodo(nombreRequisito: string, periodo: Pick<PeriodoInforme, "desde" | "hasta">, numero: number): string {
  return `${nombreRequisito} ${numero} (${etiquetaRangoPeriodo(periodo)})`;
}

/** Requisitos del catálogo que se entregan por periodos, uno por cada mes del contrato — igual que
 * la cuenta de cobro del contratista (código de formato del Manual A-BS-MA01):
 * A-BS-FO116 = Informe de supervisión, A-BS-FO132 = Formato único de informe de cumplimiento,
 * A-BS-FO127 = Acta de recibo — pago parcial, A-BS-FO117 = Informe de supervisión para obra
 * pública (mismo ritmo mensual que el informe de supervisión general, solo que para contratos de
 * obra). */
export const CODIGOS_FORMATO_POR_PERIODOS = ["A-BS-FO116", "A-BS-FO132", "A-BS-FO127", "A-BS-FO117"];

export function esRequisitoPorPeriodos(requisito: { codigoFormato: string | null }): boolean {
  return requisito.codigoFormato !== null && CODIGOS_FORMATO_POR_PERIODOS.includes(requisito.codigoFormato);
}

/** Periodos que ya se podían radicar (`radicaDesde` <= hoy) y todavía no tienen informe cargado, con su
 * número de orden dentro del contrato (Informe 1, 2…). `hoy` es el día calendario (medianoche UTC). */
export function periodosPorRadicar(
  periodos: PeriodoInforme[],
  clavesConInforme: ReadonlySet<string>,
  hoy: Date
): { numero: number; periodo: PeriodoInforme; diasDeRetraso: number }[] {
  return periodos
    .map((periodo, i) => ({ numero: i + 1, periodo }))
    .filter(({ periodo }) => periodo.radicaDesde <= hoy && !clavesConInforme.has(periodo.clave))
    .map(({ numero, periodo }) => ({ numero, periodo, diasDeRetraso: Math.floor((hoy.getTime() - periodo.radicaDesde.getTime()) / MS_DIA) }));
}
