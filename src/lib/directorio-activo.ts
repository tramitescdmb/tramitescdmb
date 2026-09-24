import { cookies } from "next/headers";

const COOKIE_TOKEN = "sinca_da_token";
const TOKEN_DURACION_SEGUNDOS = 60 * 60 * 24 * 7;

function baseUrl() {
  const url = process.env.DIRECTORIO_ACTIVO_API_URL?.trim().replace(/\/+$/, "");
  return url || null;
}

export function directorioActivoConfigurado() {
  return baseUrl() !== null;
}

export type ResultadoAutenticacion =
  | { ok: true; token: string }
  | { ok: false; mensaje: string };

export async function autenticarDirectorioActivo(
  usuario: string,
  password: string
): Promise<ResultadoAutenticacion> {
  const base = baseUrl();
  if (!base) {
    return { ok: false, mensaje: "La conexión por directorio activo no está configurada en el servidor." };
  }

  const cliente = process.env.DIRECTORIO_ACTIVO_CLIENTE?.trim() || "web";

  let respuesta: Response;
  try {
    respuesta = await fetch(`${base}/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ name: cliente, email: usuario, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error("[directorio-activo] no se pudo contactar el API:", error);
    return {
      ok: false,
      mensaje:
        "No fue posible contactar el directorio activo de la CDMB. Verifique la conexión a la red institucional o intente más tarde.",
    };
  }

  let cuerpo: unknown = null;
  try {
    cuerpo = await respuesta.json();
  } catch {}

  if (respuesta.ok) {
    const token = (cuerpo as { token?: unknown })?.token;
    if (typeof token === "string" && token.length > 0) {
      return { ok: true, token };
    }
    console.error("[directorio-activo] respuesta 2xx sin token:", cuerpo);
    return { ok: false, mensaje: "El directorio activo respondió de forma inesperada. Reporte el caso al área de sistemas." };
  }

  if (respuesta.status === 422) {
    const mensaje = (cuerpo as { message?: unknown })?.message;
    return {
      ok: false,
      mensaje: typeof mensaje === "string" && mensaje ? mensaje : "Las credenciales proporcionadas son incorrectas.",
    };
  }

  if (respuesta.status === 419) {
    console.error("[directorio-activo] 419 (CSRF) desde el API de login");
    return { ok: false, mensaje: "El directorio activo rechazó la solicitud (CSRF). Reporte el caso al área de sistemas." };
  }

  console.error(`[directorio-activo] error ${respuesta.status} en el login:`, cuerpo);
  return { ok: false, mensaje: "El directorio activo no está disponible en este momento. Intente más tarde." };
}

export async function cerrarSesionDirectorioActivo(token: string) {
  const base = baseUrl();
  if (!base) return;

  try {
    await fetch(`${base}/admin/logout`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("[directorio-activo] no se pudo cerrar sesión en el API (se ignora):", error);
  }
}

export async function guardarTokenDirectorioActivo(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_TOKEN, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_DURACION_SEGUNDOS,
  });
}

export async function leerTokenDirectorioActivo() {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_TOKEN)?.value ?? null;
}

export async function borrarTokenDirectorioActivo() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_TOKEN);
}
