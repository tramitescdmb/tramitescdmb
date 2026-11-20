import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Registro liviano del ciudadano («Solicitud ambiental» → «Mis solicitudes»): reglas puras, sin base
 * de datos. Ingreso sin contraseña con un código de 6 dígitos por correo; sesión con cookie propia,
 * distinta de la de los funcionarios.
 */

export const COOKIE_CIUDADANO = "cdmb_ciudadano";
/** La sesión del ciudadano dura 4 horas desde el ingreso. */
export const DURACION_SESION_CIUDADANO_S = 4 * 60 * 60;
export const VIGENCIA_CODIGO_MS = 10 * 60 * 1000;
export const MAX_INTENTOS_CODIGO = 5;
/** Códigos por correo: como máximo 3 cada 15 minutos y 10 al día. */
export const LIMITE_CODIGOS_15MIN = 3;
export const LIMITE_CODIGOS_DIA = 10;

/** Prueba anti-robots propia (prueba de trabajo): el navegador busca un número que haga el hash con estos bits en cero. */
export const DIFICULTAD_RETO_BITS = 15;
export const VIGENCIA_RETO_MS = 10 * 60 * 1000;

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Respuesta única al pedir un código: no revela si el correo tiene cuenta. */
export const MENSAJE_CODIGO_ENVIADO =
  "Si el correo es válido, en unos minutos le llegará un código de 6 dígitos. Revise también la carpeta de correo no deseado.";
export const MENSAJE_CODIGO_INVALIDO = "El código no es válido o ya venció. Pida uno nuevo si es necesario.";

export function normalizarCorreo(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const c = texto.trim().toLowerCase();
  return c.length <= 200 && CORREO_RE.test(c) ? c : null;
}

function secretoBase(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET no está configurado");
  return s;
}

/** Clave derivada por propósito: un HMAC de un propósito no sirve para otro. */
function hmac(proposito: string, dato: string): string {
  const clave = createHmac("sha256", secretoBase()).update(`cuenta-ciudadana:${proposito}`).digest();
  return createHmac("sha256", clave).update(dato).digest("hex");
}

function igualesSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function generarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function normalizarCodigo(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const c = texto.replace(/\D/g, "");
  return c.length === 6 ? c : null;
}

/** El código se guarda atado al correo: un código no sirve para otra dirección. */
export function hashCodigo(correo: string, codigo: string): string {
  return hmac("codigo", `${correo}\n${codigo}`);
}

export function codigoCoincide(correo: string, codigo: string, hashGuardado: string): boolean {
  return igualesSeguro(hashCodigo(correo, codigo), hashGuardado);
}

export function generarTokenSesion(): string {
  return randomBytes(32).toString("base64url");
}

export function hashTokenSesion(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ---------------------------------------------------------------------------------------------
// Prueba anti-robots (prueba de trabajo). Sin servicios externos: el servidor firma un reto con
// fecha; el navegador busca `n` tal que SHA-256(reto + ":" + n) empiece con DIFICULTAD bits en cero
// (menos de un segundo en un equipo normal); el servidor comprueba firma, vigencia y el hash.
// ---------------------------------------------------------------------------------------------

export function crearReto(ahora = Date.now()): string {
  const cuerpo = `${ahora}.${randomBytes(12).toString("base64url")}`;
  return `${cuerpo}.${hmac("reto", cuerpo).slice(0, 32)}`;
}

export function bitsCeroIniciales(hash: Buffer): number {
  let bits = 0;
  for (const byte of hash) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    return bits + Math.clz32(byte) - 24;
  }
  return bits;
}

export function retoResuelto(reto: unknown, solucion: unknown, ahora = Date.now(), dificultad = DIFICULTAD_RETO_BITS): boolean {
  if (typeof reto !== "string" || reto.length > 120) return false;
  if (typeof solucion !== "string" || !/^\d{1,12}$/.test(solucion)) return false;
  const partes = reto.split(".");
  if (partes.length !== 3) return false;
  const [ts, azar, firma] = partes as [string, string, string];
  if (!igualesSeguro(hmac("reto", `${ts}.${azar}`).slice(0, 32), firma)) return false;
  const edad = ahora - Number(ts);
  if (!Number.isFinite(edad) || edad < 0 || edad > VIGENCIA_RETO_MS) return false;
  return bitsCeroIniciales(createHash("sha256").update(`${reto}:${solucion}`).digest()) >= dificultad;
}

/** Solo se vuelve a una ruta de la vista pública: evita redirecciones abiertas. */
export function rutaSiguienteSegura(valor: unknown): string {
  const porDefecto = "/solicitud-ambiental/mis-solicitudes";
  if (typeof valor !== "string") return porDefecto;
  if (!/^\/solicitud-ambiental(\/[A-Za-z0-9\-_/]*)?(\?[A-Za-z0-9=&\-_]*)?$/.test(valor) || valor.includes("//")) return porDefecto;
  return valor;
}

/**
 * Defensa adicional contra envíos desde otros sitios (además de la cookie SameSite=Lax): si el
 * navegador manda Origin, debe ser este mismo servidor.
 */
export function origenPermitido(headers: Headers): boolean {
  const origen = headers.get("origin");
  if (!origen) return true;
  const host = headers.get("x-forwarded-host") || headers.get("host");
  try {
    return Boolean(host) && new URL(origen).host === host;
  } catch {
    return false;
  }
}
