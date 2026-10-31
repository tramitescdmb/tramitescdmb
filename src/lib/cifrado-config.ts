import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function clave(): Buffer {
  const base = process.env.CLAVE_CIFRADO_CONFIG?.trim() || process.env.SESSION_SECRET;
  if (!base) throw new Error("No hay clave para cifrar la configuración (CLAVE_CIFRADO_CONFIG o SESSION_SECRET).");
  return createHash("sha256").update(`config:${base}`).digest();
}

export function cifrarSecreto(texto: string): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", clave(), iv);
  const datos = Buffer.concat([cifrador.update(texto, "utf8"), cifrador.final()]);
  return ["v1", iv.toString("base64"), cifrador.getAuthTag().toString("base64"), datos.toString("base64")].join(":");
}

export function descifrarSecreto(valor: string): string {
  const [version, iv, etiqueta, datos] = valor.split(":");
  if (version !== "v1" || !iv || !etiqueta || !datos) throw new Error("Secreto con formato desconocido.");
  const descifrador = createDecipheriv("aes-256-gcm", clave(), Buffer.from(iv, "base64"));
  descifrador.setAuthTag(Buffer.from(etiqueta, "base64"));
  return Buffer.concat([descifrador.update(Buffer.from(datos, "base64")), descifrador.final()]).toString("utf8");
}
