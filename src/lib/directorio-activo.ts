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

export type PerfilDirectorio = {
  nombres?: string;
  apellidos?: string;
  nombreCompleto?: string;
  email?: string;
  celular?: string;
  telefono?: string;
  documento?: string;
  direccion?: string;
  dependencia?: string;
};

export type ResultadoAutenticacion =
  | { ok: true; token: string; perfil: PerfilDirectorio }
  | { ok: false; mensaje: string };

// Nombres de campo "candidatos" por los que preguntamos, combinando el estándar LDAP/Active
// Directory (givenName, sn, streetAddress, physicalDeliveryOfficeName...) con variantes en
// español que distintos backends suelen usar. Nunca vimos una respuesta real de este API en
// este repo (ver el log "[directorio-activo] campos de la respuesta del login" más abajo, que
// existe justo para confirmarlo) — esto es mejor esfuerzo hasta tener una muestra real.
const CLAVES_PERFIL: Record<keyof PerfilDirectorio, string[]> = {
  nombres: ["givenname", "nombres", "nombre", "nombre1", "first_name", "firstname"],
  apellidos: ["sn", "surname", "apellidos", "apellido", "apellido1", "last_name", "lastname"],
  nombreCompleto: ["displayname", "cn", "name", "nombre_completo", "fullname"],
  email: ["mail", "email", "correo", "userprincipalname"],
  celular: ["mobile", "celular", "movil", "telefono_movil"],
  telefono: ["telephonenumber", "telefono", "phone"],
  documento: ["employeeid", "employeenumber", "cedula", "documento", "identificacion"],
  // "departamento" se deja fuera a propósito: en esta app ya significa la división
  // geográfica (Santander, etc.), no la dependencia/oficina del funcionario.
  direccion: ["streetaddress", "direccion", "address", "postaladdress"],
  dependencia: ["physicaldeliveryofficename", "department", "dependencia", "office", "oficina", "ou"],
};

/**
 * Si el API solo entrega un nombre completo (sin nombres/apellidos por separado), lo partimos
 * como mejor esfuerzo siguiendo el patrón más común en Colombia: 4 palabras → 2+2, 3 palabras →
 * 1+2, 2 palabras → 1+1. Es una heurística, no siempre va a acertar (hay nombres compuestos que
 * no siguen este patrón) — mejor esto que dejar nombres/apellidos vacíos y mostrar el usuario de
 * red como si fuera el nombre.
 */
function partirNombreCompleto(nombreCompleto: string): { nombres: string; apellidos: string } | null {
  const palabras = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length < 2) return null;
  if (palabras.length >= 4) return { nombres: palabras.slice(0, 2).join(" "), apellidos: palabras.slice(2).join(" ") };
  if (palabras.length === 3) return { nombres: palabras[0]!, apellidos: palabras.slice(1).join(" ") };
  return { nombres: palabras[0]!, apellidos: palabras[1]! };
}

function aplanar(valor: unknown, prefijo = "", salida: Record<string, unknown> = {}, profundidad = 0): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || profundidad > 3) return salida;
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    const clave = prefijo ? `${prefijo}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) aplanar(v, clave, salida, profundidad + 1);
    else salida[clave] = Array.isArray(v) ? v[0] : v;
  }
  return salida;
}

export function extraerPerfil(cuerpo: unknown, usuarioRed?: string): PerfilDirectorio {
  const plano = aplanar(cuerpo);
  const perfil: PerfilDirectorio = {};
  const usuarioNormalizado = usuarioRed?.trim().toLowerCase() || null;
  for (const [campo, candidatos] of Object.entries(CLAVES_PERFIL) as [keyof PerfilDirectorio, string[]][]) {
    for (const [clave, v] of Object.entries(plano)) {
      const hoja = clave.split(".").pop()!.toLowerCase();
      if (clave === "message" || clave === "token") continue;
      if (!candidatos.includes(hoja) || typeof v !== "string" || !v.trim()) continue;
      const valor = v.trim();
      // Algunos directorios mal configurados repiten el usuario de red en el campo de nombre
      // (displayName/cn = sAMAccountName) — eso no es un nombre real: mejor dejar el campo vacío
      // (y que quede el nombre provisional a partir del usuario, o que un administrador lo escriba
      // a mano una vez) que mostrar el usuario de red como si fuera el nombre de la persona.
      if (usuarioNormalizado && valor.toLowerCase() === usuarioNormalizado) continue;
      if (campo === "nombreCompleto" && !/\s/.test(valor)) continue;
      perfil[campo] ??= valor;
    }
  }
  if (perfil.email && !perfil.email.includes("@")) delete perfil.email;
  if ((!perfil.nombres || !perfil.apellidos) && perfil.nombreCompleto) {
    const partido = partirNombreCompleto(perfil.nombreCompleto);
    if (partido) {
      perfil.nombres ??= partido.nombres;
      perfil.apellidos ??= partido.apellidos;
    }
  }
  return perfil;
}

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
      console.info("[directorio-activo] campos de la respuesta del login:", Object.keys(aplanar(cuerpo)).join(", "));
      return { ok: true, token, perfil: extraerPerfil(cuerpo, usuario) };
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
