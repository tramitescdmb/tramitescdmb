import { eliminar, firmarSubida, urlPublica } from "@/lib/almacen";

const BUCKET = "branding";

export function buildBrandingPath(campo: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${campo}/${Date.now()}-${safeName}`;
}

export async function crearUrlSubidaFirmadaBranding(path: string) {
  return firmarSubida(BUCKET, path);
}

export function getBrandingPublicUrl(path: string) {
  return urlPublica(BUCKET, path);
}

export async function deleteBranding(path: string) {
  await eliminar(BUCKET, [path]);
}
