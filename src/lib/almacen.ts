import crypto from "crypto";
import { constants as fsConst } from "fs";
import fs from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";

export const BUCKETS_PUBLICOS = new Set(["branding"]);
const BUCKETS_VALIDOS = new Set(["documentos", "branding"]);

export function almacenLocal(): string | null {
  return process.env.ALMACEN_LOCAL_DIR?.trim() || null;
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase no está configurado (faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
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

export async function subir(bucket: string, ruta: string, contenido: Buffer, contentType: string, upsert = false) {
  if (almacenLocal()) {
    const destino = rutaFisica(bucket, ruta);
    await fs.mkdir(path.dirname(destino), { recursive: true });
    await fs.writeFile(destino, contenido, { flag: upsert ? "w" : "wx" });
    return;
  }
  const { error } = await supabaseAdmin().storage.from(bucket).upload(ruta, contenido, { contentType, upsert });
  if (error) throw error;
}

/** `topeMb` amplía, solo para esta subida, el tope por archivo del almacenamiento local (lo firma el servidor). */
export async function firmarSubida(bucket: string, ruta: string, topeMb?: number): Promise<{ path: string; token: string }> {
  if (almacenLocal()) {
    const exp = String(Math.floor(Date.now() / 1000) + 2 * 3600);
    const r = limpiar(ruta);
    if (topeMb && topeMb > 0) {
      const mb = String(Math.floor(topeMb));
      return { path: r, token: `${exp}.${mb}.${firmar("subir", bucket, r, exp, mb)}` };
    }
    return { path: r, token: `${exp}.${firmar("subir", bucket, r, exp)}` };
  }
  const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUploadUrl(ruta);
  if (error) throw error;
  return { path: data.path, token: data.token };
}

export async function urlFirmada(bucket: string, ruta: string, segundos: number, descargar?: string): Promise<string> {
  if (almacenLocal()) {
    const r = limpiar(ruta);
    const exp = String(Math.floor(Date.now() / 1000) + segundos);
    const u = new URL(`${urlBase()}/api/almacen/${bucket}/${codificar(r)}`);
    u.searchParams.set("exp", exp);
    if (descargar) u.searchParams.set("descargar", descargar);
    u.searchParams.set("firma", firmar("leer", bucket, r, exp, descargar ?? ""));
    return u.toString();
  }
  const { data, error } = await supabaseAdmin()
    .storage.from(bucket)
    .createSignedUrl(ruta, segundos, descargar ? { download: descargar } : undefined);
  if (error || !data) throw error ?? new Error("No se pudo firmar la URL del archivo.");
  return data.signedUrl;
}

export function urlPublica(bucket: string, ruta: string): string {
  if (almacenLocal()) return `${urlBase()}/api/almacen/${bucket}/${codificar(ruta)}`;
  return supabaseAdmin().storage.from(bucket).getPublicUrl(ruta).data.publicUrl;
}

export async function descargar(bucket: string, ruta: string): Promise<Buffer> {
  if (almacenLocal()) return fs.readFile(rutaFisica(bucket, ruta));
  const { data, error } = await supabaseAdmin().storage.from(bucket).download(ruta);
  if (error || !data) throw error ?? new Error("No se pudo descargar el documento");
  return Buffer.from(await data.arrayBuffer());
}

/** true si el archivo está guardado. Fuera del almacenamiento local no se consulta y se asume que sí. */
export async function existe(bucket: string, ruta: string): Promise<boolean> {
  if (!almacenLocal()) return true;
  try {
    return (await fs.stat(rutaFisica(bucket, ruta))).isFile();
  } catch {
    return false;
  }
}

export async function eliminar(bucket: string, rutas: string[]) {
  if (rutas.length === 0) return;
  if (almacenLocal()) {
    for (const r of rutas) await fs.rm(rutaFisica(bucket, r), { force: true });
    return;
  }
  const { error } = await supabaseAdmin().storage.from(bucket).remove(rutas);
  if (error) throw error;
}

/**
 * Mueve un archivo dentro del mismo bucket sin pisar otro: si `destino` ya existe prueba "nombre_2",
 * "nombre_3"… Devuelve la ruta final. El contenido no cambia (la huella de firma sigue valiendo).
 */
export async function mover(bucket: string, origen: string, destino: string, variante: (ruta: string, n: number) => string): Promise<string> {
  for (let n = 1; n <= 500; n++) {
    const candidata = limpiar(variante(destino, n));
    if (candidata === limpiar(origen)) return candidata;
    if (almacenLocal()) {
      const src = rutaFisica(bucket, origen);
      const dst = rutaFisica(bucket, candidata);
      await fs.mkdir(path.dirname(dst), { recursive: true });
      try {
        // link falla con EEXIST si ya hay un archivo con ese nombre: así no se pisa nada, ni en carrera.
        await fs.link(src, dst);
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code === "EEXIST") continue;
        if (code === "ENOENT") throw e;
        // Sistemas de archivos sin enlaces duros: copia exclusiva y comprobación del tamaño.
        try {
          await fs.copyFile(src, dst, fsConst.COPYFILE_EXCL);
        } catch (e2) {
          if ((e2 as NodeJS.ErrnoException).code === "EEXIST") continue;
          throw e2;
        }
        const [a, b] = await Promise.all([fs.stat(src), fs.stat(dst)]);
        if (a.size !== b.size) {
          await fs.rm(dst, { force: true });
          throw new Error(`La copia de ${origen} quedó incompleta`);
        }
      }
      await fs.unlink(src);
      return candidata;
    }
    const { error } = await supabaseAdmin().storage.from(bucket).move(origen, candidata);
    if (!error) return candidata;
    if (!/exist/i.test(error.message)) throw error;
  }
  throw new Error(`No se encontró un nombre libre para ${destino}`);
}

/** Borra las carpetas que quedaron vacías desde `carpeta` hacia arriba (sin tocar la raíz del bucket). */
export async function limpiarCarpetasVacias(bucket: string, carpeta: string) {
  if (!almacenLocal()) return;
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
  if (almacenLocal()) {
    try {
      const items = await fs.readdir(rutaFisica(bucket, carpeta), { withFileTypes: true });
      return items.filter((i) => i.isFile()).map((i) => i.name);
    } catch {
      return [];
    }
  }
  const { data } = await supabaseAdmin().storage.from(bucket).list(carpeta, { limit: 100 });
  return (data ?? []).map((f) => f.name);
}
