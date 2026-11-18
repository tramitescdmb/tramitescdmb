import crypto from "crypto";
import { constants as fsConst } from "fs";
import fs from "fs/promises";
import path from "path";

export const BUCKETS_PUBLICOS = new Set(["branding"]);
const BUCKETS_VALIDOS = new Set(["documentos", "branding"]);

/** Los archivos viven siempre en el NAS (ALMACEN_LOCAL_DIR). */
export function almacenLocal(): string | null {
  return process.env.ALMACEN_LOCAL_DIR?.trim() || null;
}

function secreto(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("Falta SESSION_SECRET");
  return s;
}

function urlBase(): string {
  const base = process.env.URL_PLATAFORMA?.trim();
  if (!base) throw new Error("Falta URL_PLATAFORMA para el almacenamiento local");
  return base.replace(/\/+$/, "");
}

function limpiar(ruta: string): string {
  return ruta.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");
}

export function rutaFisica(bucket: string, ruta: string): string {
  const raiz = almacenLocal();
  if (!raiz) throw new Error("Almacenamiento local no configurado");
  if (!BUCKETS_VALIDOS.has(bucket)) throw new Error("Bucket no válido");
  const base = path.resolve(raiz, bucket);
  const destino = path.resolve(base, limpiar(ruta));
  if (destino !== base && !destino.startsWith(base + path.sep)) throw new Error("Ruta no válida");
  return destino;
}

function codificar(ruta: string): string {
  return limpiar(ruta).split("/").map(encodeURIComponent).join("/");
}

export function firmar(...partes: string[]): string {
  return crypto.createHmac("sha256", secreto()).update(partes.join("\n")).digest("base64url");
}

export function firmaValida(esperada: string, recibida: string | null): boolean {
  if (!recibida) return false;
  const a = Buffer.from(esperada);
  const b = Buffer.from(recibida);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const TIPOS: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  heic: "image/heic",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json",
  html: "text/html; charset=utf-8",
  xml: "application/xml",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  kml: "application/vnd.google-earth.kml+xml",
  kmz: "application/vnd.google-earth.kmz",
};

export function tipoPorExtension(ruta: string): string {
  const ext = ruta.split(".").pop()?.toLowerCase() ?? "";
  return TIPOS[ext] ?? "application/octet-stream";
}

/**
 * mkdir -p + escritura. Si otra petición borra la carpeta vacía entre las dos (limpiarCarpetasVacias
 * tras mover un archivo), la escritura da ENOENT: se vuelve a crear la carpeta y se reintenta.
 */
export async function escribirArchivo(destino: string, contenido: Buffer, flag: "w" | "wx") {
  for (let intento = 1; ; intento++) {
    await fs.mkdir(path.dirname(destino), { recursive: true });
    try {
      await fs.writeFile(destino, contenido, { flag });
      return;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT" || intento >= 5) throw e;
    }
  }
}

export async function subir(bucket: string, ruta: string, contenido: Buffer, contentType: string, upsert = false) {
  void contentType;
  await escribirArchivo(rutaFisica(bucket, ruta), contenido, upsert ? "w" : "wx");
}

/** `topeMb` amplía, solo para esta subida, el tope por archivo del almacenamiento local (lo firma el servidor). */
export async function firmarSubida(bucket: string, ruta: string, topeMb?: number): Promise<{ path: string; token: string }> {
  const exp = String(Math.floor(Date.now() / 1000) + 2 * 3600);
  const r = limpiar(ruta);
  if (topeMb && topeMb > 0) {
    const mb = String(Math.floor(topeMb));
    return { path: r, token: `${exp}.${mb}.${firmar("subir", bucket, r, exp, mb)}` };
  }
  return { path: r, token: `${exp}.${firmar("subir", bucket, r, exp)}` };
}

export async function urlFirmada(bucket: string, ruta: string, segundos: number, descargar?: string): Promise<string> {
  rutaFisica(bucket, ruta); // valida el bucket y la ruta
  const r = limpiar(ruta);
  const exp = String(Math.floor(Date.now() / 1000) + segundos);
  const u = new URL(`${urlBase()}/api/almacen/${bucket}/${codificar(r)}`);
  u.searchParams.set("exp", exp);
  if (descargar) u.searchParams.set("descargar", descargar);
  u.searchParams.set("firma", firmar("leer", bucket, r, exp, descargar ?? ""));
  return u.toString();
}

export function urlPublica(bucket: string, ruta: string): string {
  return `${urlBase()}/api/almacen/${bucket}/${codificar(ruta)}`;
}

export async function descargar(bucket: string, ruta: string): Promise<Buffer> {
  return fs.readFile(/*turbopackIgnore: true*/ rutaFisica(bucket, ruta));
}

/** true si el archivo está guardado en el NAS. */
export async function existe(bucket: string, ruta: string): Promise<boolean> {
  try {
    return (await fs.stat(/*turbopackIgnore: true*/ rutaFisica(bucket, ruta))).isFile();
  } catch {
    return false;
  }
}

export async function eliminar(bucket: string, rutas: string[]) {
  if (rutas.length === 0) return;
  for (const r of rutas) await fs.rm(rutaFisica(bucket, r), { force: true });
}

/**
 * Mueve un archivo dentro del mismo bucket sin pisar otro: si `destino` ya existe prueba "nombre_2",
 * "nombre_3"… Devuelve la ruta final. El contenido no cambia (la huella de firma sigue valiendo).
 */
export async function mover(bucket: string, origen: string, destino: string, variante: (ruta: string, n: number) => string): Promise<string> {
  let reintentos = 0;
  for (let n = 1; n <= 500; n++) {
    const candidata = limpiar(variante(destino, n));
    if (candidata === limpiar(origen)) return candidata;
    const src = rutaFisica(bucket, origen);
    const dst = rutaFisica(bucket, candidata);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    try {
      // link falla con EEXIST si ya hay un archivo con ese nombre: así no se pisa nada, ni en carrera.
      await fs.link(src, dst);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "EEXIST") continue;
      if (code === "ENOENT") {
        // Puede faltar el origen, o la carpeta destino recién creada la borró otra petición
        // (limpiarCarpetasVacias): en ese caso se crea de nuevo y se reintenta el mismo nombre.
        const origenExiste = await fs.stat(/*turbopackIgnore: true*/ src).then(() => true, () => false);
        if (!origenExiste || ++reintentos > 5) throw e;
        n--;
        continue;
      }
      // Sistemas de archivos sin enlaces duros: copia exclusiva y comprobación del tamaño.
      try {
        await fs.copyFile(src, dst, fsConst.COPYFILE_EXCL);
      } catch (e2) {
        const code2 = (e2 as NodeJS.ErrnoException).code;
        if (code2 === "EEXIST") continue;
        if (code2 === "ENOENT" && ++reintentos <= 5 && (await fs.stat(/*turbopackIgnore: true*/ src).then(() => true, () => false))) {
          n--;
          continue;
        }
        throw e2;
      }
      const [a, b] = await Promise.all([fs.stat(/*turbopackIgnore: true*/ src), fs.stat(/*turbopackIgnore: true*/ dst)]);
      if (a.size !== b.size) {
        await fs.rm(dst, { force: true });
        throw new Error(`La copia de ${origen} quedó incompleta`);
      }
    }
    await fs.unlink(src);
    return candidata;
  }
  throw new Error(`No se encontró un nombre libre para ${destino}`);
}

/** Borra las carpetas que quedaron vacías desde `carpeta` hacia arriba (sin tocar la raíz del bucket). */
export async function limpiarCarpetasVacias(bucket: string, carpeta: string) {
  let actual = limpiar(carpeta);
  while (actual) {
    try {
      await fs.rmdir(rutaFisica(bucket, actual));
    } catch {
      return;
    }
    actual = actual.includes("/") ? actual.slice(0, actual.lastIndexOf("/")) : "";
  }
}

export async function listar(bucket: string, carpeta: string): Promise<string[]> {
  try {
    const items = await fs.readdir(/*turbopackIgnore: true*/ rutaFisica(bucket, carpeta), { withFileTypes: true });
    return items.filter((i) => i.isFile()).map((i) => i.name);
  } catch {
    return [];
  }
}
