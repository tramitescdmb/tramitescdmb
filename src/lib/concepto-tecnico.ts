import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fechaLarga } from "@/lib/formato-visita";
import { partesColombia } from "@/lib/planeador";

export const SERIE_CONCEPTO = "CONCEPTO_EV";

export function claveConcepto(numero: number, anio: number): string {
  return `EV-${String(numero).padStart(4, "0")}-${anio}`;
}

export function etiquetaConcepto(clave: string, fecha: Date | null): string {
  const m = /^(EV-\d+)-(\d{4})$/.exec(clave);
  const corto = m ? m[1] : clave;
  return fecha ? `${corto} DE ${fechaLarga(partesColombia(fecha).fecha).toUpperCase()}` : corto!;
}

export class ConsecutivoNoConfigurado extends Error {}

export async function siguienteConcepto(anio: number): Promise<number | null> {
  const fila = await db.consecutivoRadicado.findUnique({ where: { serie_anio: { serie: SERIE_CONCEPTO, anio } } });
  return fila ? fila.ultimoNumero + 1 : null;
}

export async function configurarConsecutivoConcepto(anio: number, siguiente: number): Promise<void> {
  const prefijo = `-${anio}`;
  const usados = await db.visitaTecnica.findMany({ where: { conceptoNumero: { endsWith: prefijo } }, select: { conceptoNumero: true } });
  const mayor = usados.reduce((m, u) => Math.max(m, Number(/^EV-(\d+)-/.exec(u.conceptoNumero ?? "")?.[1] ?? 0)), 0);
  if (siguiente <= mayor) throw new Error(`El número ${siguiente} ya fue usado en ${anio}; el siguiente debe ser mayor que ${mayor}.`);
  await db.consecutivoRadicado.upsert({
    where: { serie_anio: { serie: SERIE_CONCEPTO, anio } },
    update: { ultimoNumero: siguiente - 1 },
    create: { serie: SERIE_CONCEPTO, anio, ultimoNumero: siguiente - 1 },
  });
}

export async function tomarNumeroConcepto(anio: number): Promise<string> {
  try {
    const fila = await db.consecutivoRadicado.update({ where: { serie_anio: { serie: SERIE_CONCEPTO, anio } }, data: { ultimoNumero: { increment: 1 } } });
    return claveConcepto(fila.ultimoNumero, anio);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") throw new ConsecutivoNoConfigurado(`El consecutivo de conceptos técnicos de ${anio} no está configurado.`);
    throw e;
  }
}
