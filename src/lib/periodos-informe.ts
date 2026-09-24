export type PeriodoInforme = {
  clave: string;
  desde: Date;
  hasta: Date;
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

export function etiquetaRangoPeriodo(periodo: Pick<PeriodoInforme, "desde" | "hasta">): string {
  const cruzaAnio = periodo.desde.getUTCFullYear() !== periodo.hasta.getUTCFullYear();
  return `${fechaCorta(periodo.desde, cruzaAnio)} – ${fechaCorta(periodo.hasta, true)}`;
}

export function nombreDocumentoPeriodo(nombreRequisito: string, periodo: Pick<PeriodoInforme, "desde" | "hasta">, numero: number): string {
  return `${nombreRequisito} ${numero} (${etiquetaRangoPeriodo(periodo)})`;
}

export const CODIGOS_FORMATO_POR_PERIODOS = ["A-BS-FO116", "A-BS-FO132", "A-BS-FO127", "A-BS-FO117"];

export function esRequisitoPorPeriodos(requisito: { codigoFormato: string | null }): boolean {
  return requisito.codigoFormato !== null && CODIGOS_FORMATO_POR_PERIODOS.includes(requisito.codigoFormato);
}

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
