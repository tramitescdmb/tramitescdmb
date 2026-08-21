import { db } from "@/lib/db";

/** Genera un número de expediente legible: {CODIGO}-{AÑO}-{consecutivo de 4 dígitos}. */
export async function generarNumeroExpediente(tramiteCodigo: string, tramiteTipoId: string) {
  const anio = new Date().getFullYear();
  const inicioAnio = new Date(`${anio}-01-01T00:00:00.000Z`);

  const count = await db.expediente.count({
    where: { tramiteTipoId, createdAt: { gte: inicioAnio } },
  });

  const consecutivo = String(count + 1).padStart(4, "0");
  return `${tramiteCodigo}-${anio}-${consecutivo}`;
}
