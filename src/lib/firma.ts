import crypto from "crypto";

export function hashContenidoFirma(partes: {
  radicado: string;
  asunto: string;
  contenido: string | null;
  fechaIso: string;
  hashesDocumentos?: (string | null)[];
}): string {
  const documentos = (partes.hashesDocumentos ?? []).filter((h): h is string => Boolean(h));
  const base = [partes.radicado, partes.asunto, partes.contenido ?? "", partes.fechaIso, ...documentos].join("␟");
  return crypto.createHash("sha256").update(base, "utf8").digest("hex");
}
