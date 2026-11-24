/** Reconoce JPG, PNG y WebP por sus primeros bytes (no por la extensión que trae el nombre). */
export function tipoImagenPorFirma(b: Uint8Array): { mime: string; extension: string } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return { mime: "image/png", extension: "png" };
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
}
