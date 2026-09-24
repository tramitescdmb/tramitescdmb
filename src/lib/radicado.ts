import { Prisma } from "@prisma/client";
import type { TipoComunicacion } from "@prisma/client";
import { db } from "@/lib/db";

type ClientePrisma = typeof db | Prisma.TransactionClient;

const SERIE_POR_TIPO: Record<TipoComunicacion, string> = {
  RECIBIDA: "R",
  ENVIADA: "E",
  INTERNA: "I",
};

export function serieDeTipo(tipo: TipoComunicacion): string {
  return SERIE_POR_TIPO[tipo];
}

export function formatearRadicado(serie: string, anio: number, numero: number): string {
  return `CDMB-${serie}-${anio}-${String(numero).padStart(6, "0")}`;
}

export type RadicadoGenerado = { radicado: string; anio: number; numero: number; serie: string };

export async function generarConsecutivo(
  serie: string,
  anio: number = new Date().getFullYear(),
  cliente: ClientePrisma = db
): Promise<{ anio: number; numero: number; serie: string }> {
  for (let intento = 0; intento < 6; intento++) {
    try {
      const fila = await cliente.consecutivoRadicado.update({
        where: { serie_anio: { serie, anio } },
        data: { ultimoNumero: { increment: 1 } },
      });
      return { anio, numero: fila.ultimoNumero, serie };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        try {
          const creada = await cliente.consecutivoRadicado.create({ data: { serie, anio, ultimoNumero: 1 } });
          return { anio, numero: creada.ultimoNumero, serie };
        } catch (err2) {
          if (err2 instanceof Prisma.PrismaClientKnownRequestError && err2.code === "P2002") continue;
          throw err2;
        }
      }
      throw err;
    }
  }
  throw new Error("No se pudo generar el consecutivo tras varios intentos de concurrencia.");
}

export async function generarRadicado(
  tipo: TipoComunicacion,
  anio: number = new Date().getFullYear(),
  cliente: ClientePrisma = db
): Promise<RadicadoGenerado> {
  const serie = serieDeTipo(tipo);
  const { numero } = await generarConsecutivo(serie, anio, cliente);
  return { radicado: formatearRadicado(serie, anio, numero), anio, numero, serie };
}
