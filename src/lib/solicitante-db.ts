import { db } from "@/lib/db";

export async function buscarSolicitantePorDocumento(identificacion: string, tipo?: "NATURAL" | "JURIDICA") {
  const exacto = await db.solicitante.findUnique({ where: { identificacion: identificacion.trim() } });
  if (exacto) return exacto;
  const digitos = identificacion.replace(/\D/g, "");
  if (digitos.length < 5) return null;
  const filas = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "Solicitante" WHERE regexp_replace(identificacion, '[^0-9]', '', 'g') = ${digitos} ORDER BY "updatedAt" DESC LIMIT 1`;
  if (!filas[0] && tipo !== "NATURAL" && (digitos.length === 9 || digitos.length === 10)) {
    const base = digitos.slice(0, 9);
    filas.push(
      ...(await db.$queryRaw<{ id: string }[]>`SELECT id FROM "Solicitante" WHERE tipo = 'JURIDICA' AND length(regexp_replace(identificacion, '[^0-9]', '', 'g')) IN (9, 10) AND left(regexp_replace(identificacion, '[^0-9]', '', 'g'), 9) = ${base} ORDER BY "updatedAt" DESC LIMIT 1`)
    );
  }
  return filas[0] ? db.solicitante.findUnique({ where: { id: filas[0].id } }) : null;
}
