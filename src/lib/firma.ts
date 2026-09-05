import crypto from "crypto";

/**
 * Firma electrónica CON HASH (Ley 527/1999 + Decreto 2364/2012) — no es firma
 * digital con certificado de entidad de certificación acreditada. Identifica al
 * firmante (usuarioId), su intención de firmar, la marca de tiempo, y el hash
 * SHA-256 del contenido exacto que aprobó: cualquier cambio posterior al
 * contenido (asunto, cuerpo, radicado) produce un hash distinto y la firma deja
 * de corresponder — eso es lo que prueba la integridad, sin depender de un
 * tercero ni de un token físico.
 */
export function hashContenidoFirma(partes: { radicado: string; asunto: string; contenido: string | null; fechaIso: string }): string {
  const base = [partes.radicado, partes.asunto, partes.contenido ?? "", partes.fechaIso].join("␟"); // separador de unidad, evita colisiones por concatenación
  return crypto.createHash("sha256").update(base, "utf8").digest("hex");
}
