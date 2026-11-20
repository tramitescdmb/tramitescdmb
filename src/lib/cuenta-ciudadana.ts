import { TIPOS_USUARIO_CIUDADANO } from "@/lib/tipos-usuario-ciudadano";
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

// ---------------------------------------------------------------------------------------------
// Perfil del ciudadano: los mismos datos básicos que los demás registros de personas
// (DatosPersona), más caracterización y autorización de notificación electrónica.
// ---------------------------------------------------------------------------------------------

export { TIPOS_USUARIO_CIUDADANO };

export type PerfilCiudadano = {
  tipo: "NATURAL" | "JURIDICA";
  tipoIdentificacion: string;
  identificacion: string;
  nombres: string | null;
  apellidos: string | null;
  razonSocial: string | null;
  nombre: string;
  correoAlterno: string | null;
  celular: string | null;
  telefono: string | null;
  direccion: string;
  departamento: string;
  ciudad: string;
  regimenTributario: "RESPONSABLE_IVA" | "NO_RESPONSABLE_IVA" | "SIMPLE_TRIBUTACION" | "REGIMEN_ESPECIAL" | "OTRO";
  granContribuyente: boolean;
  representanteLegal: string | null;
  representanteIdentificacion: string | null;
  tipoUsuario: string;
  autorizaNotificacionElectronica: boolean;
};

/** Etiquetas de los campos para la bitácora (no se registran los valores, solo qué cambió). */
export const ETIQUETAS_PERFIL: Record<keyof PerfilCiudadano, string> = {
  tipo: "tipo de persona",
  tipoIdentificacion: "tipo de documento",
  identificacion: "documento",
  nombres: "nombres",
  apellidos: "apellidos",
  razonSocial: "razón social",
  nombre: "nombre",
  correoAlterno: "correo alterno",
  celular: "celular",
  telefono: "teléfono",
  direccion: "dirección de notificación",
  departamento: "departamento",
  ciudad: "municipio",
  regimenTributario: "régimen tributario",
  granContribuyente: "gran contribuyente",
  representanteLegal: "representante legal",
  representanteIdentificacion: "documento del representante legal",
  tipoUsuario: "tipo de usuario",
  autorizaNotificacionElectronica: "autorización de notificación electrónica",
};

const REGIMENES = ["RESPONSABLE_IVA", "NO_RESPONSABLE_IVA", "SIMPLE_TRIBUTACION", "REGIMEN_ESPECIAL", "OTRO"] as const;
const TIPOS_DOC = ["CC", "CE", "NIT", "PA", "PPT", "TI", "OTRO"];

function txt(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

/**
 * Valida el perfil enviado. La identidad (tipo de persona, tipo y número de documento) solo se toma
 * del formulario la primera vez; después llega `identidadFija` y se ignora lo que mande el navegador.
 */
export function validarPerfilCiudadano(
  body: unknown,
  opciones: { correoCuenta: string; identidadFija: { tipo: "NATURAL" | "JURIDICA"; tipoIdentificacion: string | null; identificacion: string } | null }
): { ok: true; perfil: PerfilCiudadano } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const fija = opciones.identidadFija;
  const tipo = fija ? fija.tipo : b.tipoPersona === "JURIDICA" ? "JURIDICA" : "NATURAL";
  const esJuridica = tipo === "JURIDICA";

  let tipoIdentificacion: string;
  let identificacion: string;
  if (fija) {
    tipoIdentificacion = fija.tipoIdentificacion ?? (esJuridica ? "NIT" : "CC");
    identificacion = fija.identificacion;
  } else {
    const t = txt(b.tipoIdentificacion, 10).toUpperCase();
    tipoIdentificacion = TIPOS_DOC.includes(t) ? t : esJuridica ? "NIT" : "CC";
    const escrito = txt(b.identificacion, 30);
    if (!/^[0-9A-Za-z.\-\s]{4,20}$/.test(escrito)) return { ok: false, error: esJuridica ? "Escriba el NIT (puede incluir el dígito de verificación con guion)." : "Escriba el número de documento." };
    // Misma normalización que el resto del flujo (solo dígitos, sin dígito de verificación): con ella
    // se comparan la cuenta y los expedientes.
    identificacion = escrito.replace(/-\s*\d\s*$/, "").replace(/\D/g, "");
    if (identificacion.length < 4) return { ok: false, error: "El número de documento no es válido." };
  }

  const nombres = esJuridica ? "" : txt(b.nombres, 120);
  const apellidos = esJuridica ? "" : txt(b.apellidos, 120);
  const razonSocial = esJuridica ? txt(b.razonSocial, 200) : "";
  if (esJuridica ? razonSocial.length < 2 : !nombres || !apellidos) return { ok: false, error: esJuridica ? "Escriba la razón social." : "Escriba sus nombres y apellidos." };

  const correoAlterno = txt(b.email, 160).toLowerCase();
  if (correoAlterno && !CORREO_RE.test(correoAlterno)) return { ok: false, error: "El correo alterno no es válido." };
  const celular = txt(b.celular, 30);
  const telefono = txt(b.telefono, 30);
  for (const n of [celular, telefono]) if (n && !/^[0-9+()\-\s]{7,30}$/.test(n)) return { ok: false, error: "El celular o el teléfono no es válido." };
  if (!celular && !telefono) return { ok: false, error: "Indique un celular o un teléfono de contacto." };
  const direccion = txt(b.direccion, 200);
  const departamento = txt(b.departamento, 80);
  const ciudad = txt(b.ciudad, 80);
  if (direccion.length < 5) return { ok: false, error: "Escriba la dirección de notificación." };
  if (!departamento || !ciudad) return { ok: false, error: "Indique el departamento y el municipio de notificación." };
  const regimen = txt(b.regimenTributario, 40);
  if (!(REGIMENES as readonly string[]).includes(regimen)) return { ok: false, error: "Indique el régimen tributario (si no es contribuyente de IVA, elija «No responsable de IVA»)." };
  const tipoUsuario = txt(b.tipoUsuario, 40);
  if (!TIPOS_USUARIO_CIUDADANO.some((t) => t.valor === tipoUsuario)) return { ok: false, error: "Indique qué tipo de usuario es." };
  const representanteLegal = esJuridica ? txt(b.representanteLegal, 200) : "";
  const representanteIdentificacion = esJuridica ? txt(b.representanteIdentificacion, 30) : "";
  if (esJuridica && (!representanteLegal || !representanteIdentificacion)) return { ok: false, error: "Indique el nombre y el documento del representante legal." };

  const nombre = esJuridica ? razonSocial : `${nombres} ${apellidos}`;
  return {
    ok: true,
    perfil: {
      tipo,
      tipoIdentificacion,
      identificacion,
      nombres: nombres || null,
      apellidos: apellidos || null,
      razonSocial: razonSocial || null,
      nombre,
      correoAlterno: correoAlterno && correoAlterno !== opciones.correoCuenta ? correoAlterno : null,
      celular: celular || null,
      telefono: telefono || null,
      direccion,
      departamento,
      ciudad,
      regimenTributario: regimen as PerfilCiudadano["regimenTributario"],
      granContribuyente: b.granContribuyente === true,
      representanteLegal: representanteLegal || null,
      representanteIdentificacion: representanteIdentificacion || null,
      tipoUsuario,
      autorizaNotificacionElectronica: b.autorizaNotificacionElectronica === true,
    },
  };
}

/** Qué campos cambiaron (para la bitácora: solo nombres de campo, no valores). */
export function camposCambiados(antes: Partial<Record<keyof PerfilCiudadano, unknown>>, despues: PerfilCiudadano): string[] {
  return (Object.keys(despues) as (keyof PerfilCiudadano)[])
    .filter((k) => k !== "nombre" && (antes[k] ?? null) !== (despues[k] ?? null))
    .map((k) => ETIQUETAS_PERFIL[k]);
}
