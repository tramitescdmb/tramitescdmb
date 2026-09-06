import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

/**
 * Solo sesión (JWT firmado con `jose`) — a propósito SIN bcrypt. Este archivo
 * lo importa src/middleware.ts, que corre en el Edge Runtime de Vercel, y
 * bcryptjs usa APIs de Node que el Edge Runtime no soporta (eso rompía el
 * build/despliegue). El hash/verificación de contraseñas vive aparte, en
 * src/lib/password.ts, que solo se usa desde rutas API (Node runtime normal).
 */

const COOKIE_NAME = "sinca_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 días: máximo ABSOLUTO de una sesión, así se mantenga activa sin parar.
// MoReq 6.21/6.34: cierre por inactividad. Fijo (no configurable desde BD) a propósito — el
// middleware corre en Edge Runtime y no tiene acceso a Prisma (ver nota de bcrypt más abajo).
// 30 minutos es un valor conservador razonable para un sistema de gestión documental.
const INACTIVIDAD_SEGUNDOS = 60 * 30;

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET no está configurado");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  email: string;
  nombre: string;
  rol: "ADMIN" | "FUNCIONARIO";
  /** Nombres de TODOS los cargos del funcionario — puede tener varios a la vez. */
  cargos: string[];
};

/** `loginAt` (segundos unix) viaja dentro del JWT pero no en `SessionPayload`: sirve solo para el
 * tope absoluto de 7 días, no es información de sesión que el resto de la app deba conocer. */
async function firmarToken(payload: SessionPayload, loginAt: number, expiraEnSegundos: number) {
  return new SignJWT({ ...payload, loginAt })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiraEnSegundos}s`)
    .sign(getSecretKey());
}

async function setCookie(token: string, maxAge: number) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

/**
 * Ventana de sesión deslizante (MoReq 6.21/6.34): la sesión sigue viva mientras haya actividad
 * dentro de `INACTIVIDAD_SEGUNDOS`, pero nunca más allá del tope absoluto `SESSION_DURATION_SECONDS`
 * contado desde `loginAt`. Pura y testeable aparte de `cookies()`/JWT.
 */
export function calcularVentanaSesion(loginAt: number, ahora: number): { valida: boolean; maxAge: number } {
  const transcurrido = ahora - loginAt;
  if (transcurrido >= SESSION_DURATION_SECONDS) return { valida: false, maxAge: 0 };
  const restanteHastaTope = SESSION_DURATION_SECONDS - transcurrido;
  return { valida: true, maxAge: Math.min(INACTIVIDAD_SEGUNDOS, restanteHastaTope) };
}

export async function createSessionCookie(payload: SessionPayload) {
  const loginAt = Math.floor(Date.now() / 1000);
  const { maxAge } = calcularVentanaSesion(loginAt, loginAt);
  const token = await firmarToken(payload, loginAt, maxAge);
  await setCookie(token, maxAge);
}

export async function destroySessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

function leerPayload(payload: JWTPayload): SessionPayload {
  return {
    userId: payload.userId as string,
    email: payload.email as string,
    nombre: payload.nombre as string,
    rol: payload.rol as "ADMIN" | "FUNCIONARIO",
    cargos: Array.isArray(payload.cargos) ? (payload.cargos as string[]) : [],
  };
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return leerPayload(payload);
  } catch {
    return null;
  }
}

export type ResultadoRefrescoSesion = { session: SessionPayload; nuevoToken: string; maxAge: number };

/**
 * Verifica el token Y renueva su ventana de inactividad (MoReq 6.21/6.34) — pensado para llamarse
 * en el middleware en CADA petición autenticada. `exp` ya cubre la inactividad (jose rechaza un
 * token vencido por sí solo); acá además se aplica el tope absoluto de `SESSION_DURATION_SECONDS`
 * usando `loginAt`, que no cambia entre renovaciones aunque `iat`/`exp` sí.
 */
export async function refreshSessionToken(token: string): Promise<ResultadoRefrescoSesion | null> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, getSecretKey()));
  } catch {
    return null;
  }

  const session = leerPayload(payload);
  const loginAt = typeof payload.loginAt === "number" ? payload.loginAt : Math.floor(Date.now() / 1000);
  const ventana = calcularVentanaSesion(loginAt, Math.floor(Date.now() / 1000));
  if (!ventana.valida) return null; // tope absoluto de 7 días, aunque siga activo

  const nuevoToken = await firmarToken(session, loginAt, ventana.maxAge);
  return { session, nuevoToken, maxAge: ventana.maxAge };
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
