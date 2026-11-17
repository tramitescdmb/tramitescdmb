import crypto from "crypto";
import { descargarDocumento } from "@/lib/storage";

export function sha256(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export const MENSAJE_ARCHIVO_CAMBIO =
  "El archivo guardado ya no coincide con el que firmaron antes: no se puede firmar. Avise al administrador para revisarlo.";

/**
 * Huella real del archivo tal como está guardado (NAS). La firma se amarra a esta huella, no a la que
 * reportó el navegador al subirlo. Si la registrada no coincide:
 * - sin firmas previas, se corrige la registrada (el navegador la calculó mal o no la mandó);
 * - con firmas previas, se rechaza: alguien firmó otro contenido.
 */
export async function huellaVerificada(
  doc: { storagePath: string; hashSha256: string | null },
  firmasPrevias: number,
  corregir: (hash: string) => Promise<unknown>
): Promise<string> {
  const real = sha256(await descargarDocumento(doc.storagePath));
  if (doc.hashSha256 === real) return real;
  if (firmasPrevias > 0 && doc.hashSha256) throw new Error(MENSAJE_ARCHIVO_CAMBIO);
  await corregir(real);
  return real;
}
