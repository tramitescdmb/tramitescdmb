import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "sinca_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
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
  cargos: string[];
};

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
  if (!ventana.valida) return null;

  const nuevoToken = await firmarToken(session, loginAt, ventana.maxAge);
  return { session, nuevoToken, maxAge: ventana.maxAge };
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
