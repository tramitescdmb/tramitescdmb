import crypto from "crypto";

export function hashContenidoFirma(partes: { radicado: string; asunto: string; contenido: string | null; fechaIso: string }): string {
  const base = [partes.radicado, partes.asunto, partes.contenido ?? "", partes.fechaIso].join("␟");
  return crypto.createHash("sha256").update(base, "utf8").digest("hex");
}
