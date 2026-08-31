import { cookies } from "next/headers";

/**
 * Cliente de la "Conexión por directorio activo CDMB".
 *
 * Autentica a un funcionario contra el API de directorio activo de la
 * Corporación (Laravel + Sanctum) en vez de contra la tabla `Usuario` local.
 * El flujo completo vive en `src/app/api/auth/login-directorio-activo/route.ts`:
 * este archivo solo habla con el API externo y guarda/lee el token que ese API
 * devuelve.
 *
 * IMPORTANTE — este módulo usa `next/headers` (Node runtime). NO debe importarse
 * desde `src/middleware.ts` (Edge Runtime), igual que `src/lib/password.ts`.
 *
 * Configuración (variables de entorno):
 *   DIRECTORIO_ACTIVO_API_URL   URL base del API, sin barra final.
 *                               Ej.: http://168.90.14.182/api
 *   DIRECTORIO_ACTIVO_CLIENTE   Valor del campo `name` que el API exige.
 *                               Uno de: web | app | postman | desktop.
 *                               Por defecto "web".
 */

const COOKIE_TOKEN = "sinca_da_token";
const TOKEN_DURACION_SEGUNDOS = 60 * 60 * 24 * 7; // 7 días, igual que la sesión propia

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

/**
 * Llama a `POST {base}/admin/login`. Devuelve el token de Sanctum si las
 * credenciales son correctas, o un mensaje de error apto para mostrar al
 * funcionario si no.
 */
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
      // El API nombra el campo "email" pero espera el usuario de red (el ejemplo
      // de la documentación es literalmente "usuario", sin dominio).
      body: JSON.stringify({ name: cliente, email: usuario, password }),
      cache: "no-store",
      // Si el API tarda o la red interna de la CDMB no es alcanzable, no dejamos
      // colgada la petición de login indefinidamente.
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
  } catch {
    // sin cuerpo JSON útil
  }

  if (respuesta.ok) {
    const token = (cuerpo as { token?: unknown })?.token;
    if (typeof token === "string" && token.length > 0) {
      return { ok: true, token };
    }
    console.error("[directorio-activo] respuesta 2xx sin token:", cuerpo);
    return { ok: false, mensaje: "El directorio activo respondió de forma inesperada. Reporte el caso al área de sistemas." };
  }

  // 422 de Laravel: { message, errors: { email: [...] } }
  if (respuesta.status === 422) {
    const mensaje = (cuerpo as { message?: unknown })?.message;
    return {
      ok: false,
      mensaje: typeof mensaje === "string" && mensaje ? mensaje : "Las credenciales proporcionadas son incorrectas.",
    };
  }

  if (respuesta.status === 419) {
    // Protección CSRF de Laravel. Solo debería ocurrir si /admin/login quedó
    // detrás del middleware `web` en el API; habría que pedir al área de
    // sistemas que lo exponga como ruta de API sin CSRF.
    console.error("[directorio-activo] 419 (CSRF) desde el API de login");
    return { ok: false, mensaje: "El directorio activo rechazó la solicitud (CSRF). Reporte el caso al área de sistemas." };
  }

  console.error(`[directorio-activo] error ${respuesta.status} en el login:`, cuerpo);
  return { ok: false, mensaje: "El directorio activo no está disponible en este momento. Intente más tarde." };
}

/**
 * Llama a `DELETE {base}/admin/logout` con el token del funcionario. Es de mejor
 * esfuerzo: si falla, igual cerramos la sesión propia (el que manda es la cookie
 * de esta app, no el token del API).
 */
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

// --- Cookie con el token del API (aparte de la cookie de sesión propia) --------

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
