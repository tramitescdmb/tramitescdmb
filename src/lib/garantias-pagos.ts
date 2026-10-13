export const AMPAROS_GARANTIA: { valor: string; etiqueta: string }[] = [
  { valor: "CUMPLIMIENTO", etiqueta: "Cumplimiento" },
  { valor: "BUEN_MANEJO_ANTICIPO", etiqueta: "Buen manejo del anticipo" },
  { valor: "PAGO_ANTICIPADO", etiqueta: "Devolución del pago anticipado" },
  { valor: "SALARIOS_PRESTACIONES", etiqueta: "Salarios, prestaciones sociales e indemnizaciones" },
  { valor: "ESTABILIDAD_OBRA", etiqueta: "Estabilidad y calidad de la obra" },
  { valor: "CALIDAD_SERVICIO", etiqueta: "Calidad del servicio" },
  { valor: "CALIDAD_BIENES", etiqueta: "Calidad y correcto funcionamiento de los bienes" },
  { valor: "RESPONSABILIDAD_CIVIL", etiqueta: "Responsabilidad civil extracontractual" },
];

export const ETIQUETA_AMPARO = Object.fromEntries(AMPAROS_GARANTIA.map((a) => [a.valor, a.etiqueta])) as Record<string, string>;

export type GarantiaResumen = { vigenciaHasta: Date; aprobadaEn: Date | null; createdAt: Date };
export type ModificacionResumen = { numero: number; tipo: string; createdAt: Date };

const AFECTAN_GARANTIA = new Set(["PRORROGA", "ADICION_VALOR", "PRORROGA_Y_ADICION", "SUSPENSION", "CESION"]);

export function avisosGarantia(garantias: GarantiaResumen[], terminacion: Date | null, modificaciones: ModificacionResumen[]): string[] {
  if (garantias.length === 0) return [];
  const avisos: string[] = [];
  if (garantias.some((g) => !g.aprobadaEn)) avisos.push("Hay garantías sin aprobar: el contrato no puede ejecutarse sin la aprobación (Ley 80 de 1993, art. 41).");
  const ultimaVigencia = Math.max(...garantias.map((g) => g.vigenciaHasta.getTime()));
  if (terminacion && ultimaVigencia < terminacion.getTime()) {
    avisos.push("La garantía vence antes de la terminación vigente: amplíe su vigencia (Decreto 1082 de 2015, art. 2.2.1.2.3.1.18).");
  }
  const ultimaGarantia = Math.max(...garantias.map((g) => g.createdAt.getTime()));
  const pendientes = modificaciones.filter((m) => AFECTAN_GARANTIA.has(m.tipo) && m.createdAt.getTime() > ultimaGarantia);
  if (pendientes.length > 0) {
    avisos.push(
      `Actualice la garantía por la modificación N.° ${pendientes.map((m) => m.numero).join(", ")}: el contratista debe ampliar su valor o vigencia, o cambiar el tomador si hubo cesión.`
    );
  }
  return avisos;
}

export function resumenPagos(valorTotal: number | null, pagos: { valor: number }[]) {
  const pagado = pagos.reduce((a, p) => a + p.valor, 0);
  const saldo = valorTotal !== null ? valorTotal - pagado : null;
  const porcentaje = valorTotal ? Math.round((pagado / valorTotal) * 1000) / 10 : null;
  return { pagado, saldo, porcentaje };
}

export function porcentajePlazo(inicio: Date | null, terminacion: Date | null, hoy: Date = new Date()): number | null {
  if (!inicio || !terminacion) return null;
  const total = Math.max(1, terminacion.getTime() - inicio.getTime());
  return Math.min(100, Math.max(0, Math.round(((hoy.getTime() - inicio.getTime()) / total) * 1000) / 10));
}
