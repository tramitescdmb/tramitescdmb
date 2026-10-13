export const SMMLV_POR_ANIO: Record<number, number> = {
  2018: 781_242,
  2019: 828_116,
  2020: 877_803,
  2021: 908_526,
  2022: 1_000_000,
  2023: 1_160_000,
  2024: 1_300_000,
  2025: 1_423_500,
  2026: 1_750_905,
};

const ANIOS = Object.keys(SMMLV_POR_ANIO).map(Number).sort((a, b) => a - b);

export function smmlvDe(anio: number): number {
  const conocido = [...ANIOS].reverse().find((a) => a <= anio) ?? ANIOS[0]!;
  return SMMLV_POR_ANIO[conocido]!;
}

export function smmlvConocido(anio: number): boolean {
  return anio in SMMLV_POR_ANIO;
}

export function enSmmlv(valor: number, fecha: Date): number {
  return valor / smmlvDe(fecha.getUTCFullYear());
}

export function formatearSmmlv(n: number): string {
  return `${n.toLocaleString("es-CO", { maximumFractionDigits: 2 })} SMMLV`;
}
