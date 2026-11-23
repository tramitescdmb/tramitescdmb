import { eliminar, firmarSubida, rutaPublica, urlPublica } from "@/lib/almacen";

const BUCKET = "branding";

export function buildBrandingPath(campo: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${campo}/${Date.now()}-${safeName}`;
}

export async function crearUrlSubidaFirmadaBranding(path: string) {
  return firmarSubida(BUCKET, path);
}

/** URL absoluta: solo para correos. */
export function getBrandingPublicUrl(path: string) {
  return urlPublica(BUCKET, path);
}

/** Ruta relativa para mostrar logos y sellos dentro de la plataforma. */
export function getBrandingRuta(path: string) {
  return rutaPublica(BUCKET, path);
}

export async function deleteBranding(path: string) {
  await eliminar(BUCKET, [path]);
}
