import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Solo sesión (JWT firmado con `jose`) — a propósito SIN bcrypt. Este archivo
 * lo importa src/middleware.ts, que corre en el Edge Runtime de Vercel, y
 * bcryptjs usa APIs de Node que el Edge Runtime no soporta (eso rompía el
 * build/despliegue). El hash/verificación de contraseñas vive aparte, en
 * src/lib/password.ts, que solo se usa desde rutas API (Node runtime normal).
 */

const COOKIE_NAME = "sinca_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 días

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

export async function createSessionCookie(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function destroySessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      nombre: payload.nombre as string,
      rol: payload.rol as "ADMIN" | "FUNCIONARIO",
      cargos: Array.isArray(payload.cargos) ? (payload.cargos as string[]) : [],
    };
  } catch {
    return null;
  }
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      nombre: payload.nombre as string,
      rol: payload.rol as "ADMIN" | "FUNCIONARIO",
      cargos: Array.isArray(payload.cargos) ? (payload.cargos as string[]) : [],
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
