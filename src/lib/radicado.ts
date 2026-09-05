import { Prisma } from "@prisma/client";
import type { TipoComunicacion } from "@prisma/client";
import { db } from "@/lib/db";

/** Cliente Prisma o cliente de transacción — para poder radicar dentro de un `$transaction`. */
type ClientePrisma = typeof db | Prisma.TransactionClient;

/**
 * Radicación consecutiva ATÓMICA e inalterable (Acuerdo 060/2001 AGN).
 *
 * A diferencia de `generarNumeroExpediente` (src/lib/expedientes.ts), que hace
 * `COUNT(*) + 1` y es race-prone (dos radicaciones simultáneas obtienen el mismo
 * número), acá el consecutivo sale de un `UPDATE ... ultimoNumero = ultimoNumero + 1
 * RETURNING` sobre una fila única `(serie, año)`. Ese UPDATE toma el row-lock de
 * Postgres y devuelve el valor que ÉL asignó, así dos peticiones concurrentes se
 * serializan y nunca comparten número (probado en el test de concurrencia).
 */

const SERIE_POR_TIPO: Record<TipoComunicacion, string> = {
  RECIBIDA: "R",
  ENVIADA: "E",
  INTERNA: "I",
};

export function serieDeTipo(tipo: TipoComunicacion): string {
  return SERIE_POR_TIPO[tipo];
}

/** Formato institucional del radicado, ej. `CDMB-R-2026-000123`. */
export function formatearRadicado(serie: string, anio: number, numero: number): string {
  return `CDMB-${serie}-${anio}-${String(numero).padStart(6, "0")}`;
}

export type RadicadoGenerado = { radicado: string; anio: number; numero: number; serie: string };

export async function generarRadicado(
  tipo: TipoComunicacion,
  anio: number = new Date().getFullYear(),
  cliente: ClientePrisma = db
): Promise<RadicadoGenerado> {
  const serie = serieDeTipo(tipo);

  // Estrategia: intentar el UPDATE atómico; si la fila (serie,año) aún no existe
  // (primera radicación del año), crearla; si el create choca por unique porque
  // otra petición la creó primero, reintentar el UPDATE. Tras existir la fila,
  // TODO radicado pasa por el UPDATE atómico con RETURNING.
  for (let intento = 0; intento < 6; intento++) {
    try {
      const fila = await cliente.consecutivoRadicado.update({
        where: { serie_anio: { serie, anio } },
        data: { ultimoNumero: { increment: 1 } },
      });
      return { radicado: formatearRadicado(serie, anio, fila.ultimoNumero), anio, numero: fila.ultimoNumero, serie };
    } catch (err) {
      // P2025 = la fila no existe todavía → crearla
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        try {
          const creada = await cliente.consecutivoRadicado.create({ data: { serie, anio, ultimoNumero: 1 } });
          return { radicado: formatearRadicado(serie, anio, creada.ultimoNumero), anio, numero: creada.ultimoNumero, serie };
        } catch (err2) {
          // P2002 = otra petición creó la fila entre medias → reintentar el UPDATE
          if (err2 instanceof Prisma.PrismaClientKnownRequestError && err2.code === "P2002") continue;
          throw err2;
        }
      }
      throw err;
    }
  }
  throw new Error("No se pudo generar el radicado tras varios intentos de concurrencia.");
}
