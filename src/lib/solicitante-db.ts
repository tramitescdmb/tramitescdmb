import { db } from "@/lib/db";

export async function buscarSolicitantePorDocumento(identificacion: string) {
  const exacto = await db.solicitante.findUnique({ where: { identificacion: identificacion.trim() } });
  if (exacto) return exacto;
  const digitos = identificacion.replace(/\D/g, "");
  if (digitos.length < 5) return null;
  const filas = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "Solicitante" WHERE regexp_replace(identificacion, '\D', '', 'g') = ${digitos} ORDER BY "updatedAt" DESC LIMIT 1`;
  return filas[0] ? db.solicitante.findUnique({ where: { id: filas[0].id } }) : null;
}
