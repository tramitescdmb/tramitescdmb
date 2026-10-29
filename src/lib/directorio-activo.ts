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
  usuarioRed?: string;
};

export type ResultadoAutenticacion =
  | { ok: true; token: string; perfil: PerfilDirectorio }
  | { ok: false; mensaje: string };

const CLAVES_PERFIL: Record<keyof PerfilDirectorio, string[]> = {
  nombres: ["usu_nombre", "givenname", "nombres", "nombre", "nombre1", "first_name", "firstname"],
  apellidos: ["usu_apellido", "sn", "surname", "apellidos", "apellido", "apellido1", "last_name", "lastname"],
  nombreCompleto: ["usu_nombre_mostrar", "displayname", "cn", "name", "nombre_completo", "fullname"],
  email: ["mail", "email", "correo", "userprincipalname"],
  celular: ["usu_movil", "mobile", "celular", "movil", "telefono_movil"],
  telefono: ["usu_telefono", "telephonenumber", "telefono", "phone"],
  documento: ["usu_id_empleado", "employeeid", "employeenumber", "cedula", "documento", "identificacion"],
  // "departamento" se deja fuera a propósito: en esta app ya significa la división
  // geográfica (Santander, etc.), no la dependencia/oficina del funcionario.
  direccion: ["usu_direccion_postal", "streetaddress", "direccion", "address", "postaladdress"],
  dependencia: ["usu_departamento", "physicaldeliveryofficename", "department", "dependencia", "office", "oficina", "ou"],
  usuarioRed: ["usu_apodo", "samaccountname", "usuario_red", "username"],
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
      if (campo !== "usuarioRed" && usuarioNormalizado && valor.toLowerCase() === usuarioNormalizado) continue;
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

export type ResultadoConsultaDirectorio =
  | { ok: true; perfil: PerfilDirectorio }
  | { ok: false; mensaje: string; noDisponible?: boolean };

const RUTA_DIRECTORIO = "admin/directorio-activo";

function rutaConsulta() {
  return process.env.DIRECTORIO_ACTIVO_CONSULTA_RUTA?.trim().replace(/^\/+/, "") || `${RUTA_DIRECTORIO}/{documento}`;
}

function esSinResultados(cuerpo: unknown): boolean {
  const texto = typeof cuerpo === "object" && cuerpo ? JSON.stringify(cuerpo) : String(cuerpo ?? "");
  return /no ldap query results|no se encontr|sin resultados/i.test(texto);
}

function credencialesServicio() {
  const usuario = process.env.DIRECTORIO_ACTIVO_SERVICIO_USUARIO || process.env.SINCA_API_USUARIO;
  const password = process.env.DIRECTORIO_ACTIVO_SERVICIO_CLAVE || process.env.SINCA_API_PASSWORD;
  return usuario && password ? { usuario, password } : null;
}

export function consultaDirectorioDisponible() {
  return Boolean(baseUrl() && rutaConsulta() && credencialesServicio());
}

export async function abrirSesionServicioDirectorio(): Promise<{ ok: true; token: string } | { ok: false; mensaje: string }> {
  const cred = credencialesServicio();
  if (!cred) return { ok: false, mensaje: "Faltan las credenciales de servicio del directorio activo." };
  const login = await autenticarDirectorioActivo(cred.usuario, cred.password);
  return login.ok ? { ok: true, token: login.token } : { ok: false, mensaje: `No fue posible conectar con el directorio activo: ${login.mensaje}` };
}

export async function consultarDirectorioPorDocumento(documento: string, tokenServicio?: string): Promise<ResultadoConsultaDirectorio> {
  const doc = documento.replace(/\D/g, "");
  if (doc.length < 5) return { ok: false, mensaje: "Escriba el número de cédula completo." };
  const base = baseUrl();
  const ruta = rutaConsulta();
  if (!base || !ruta || !credencialesServicio()) {
    return {
      ok: false,
      noDisponible: true,
      mensaje: "El API EME todavía no ofrece la consulta de funcionarios por cédula (employeeID). Diligencie los datos a mano; la sincronización quedará activa cuando EME publique esa consulta.",
    };
  }
  let token = tokenServicio;
  if (!token) {
    const sesion = await abrirSesionServicioDirectorio();
    if (!sesion.ok) return { ok: false, mensaje: sesion.mensaje };
    token = sesion.token;
  }
  try {
    const respuesta = await fetch(`${base}/${ruta.replace("{documento}", encodeURIComponent(doc))}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (respuesta.status === 404) {
      const cuerpo = await respuesta.json().catch(() => ({}));
      const recurso = typeof cuerpo?.message === "string" && /recurso no encontrado/i.test(cuerpo.message);
      return recurso
        ? { ok: false, noDisponible: true, mensaje: "El API EME no tiene publicada la consulta configurada. Verifique la ruta con EME." }
        : { ok: false, mensaje: `No hay un funcionario con la cédula ${doc} en el directorio activo.` };
    }
    if (!respuesta.ok) {
      const cuerpo = await respuesta.json().catch(() => null);
      if (esSinResultados(cuerpo)) return { ok: false, mensaje: `No hay un funcionario con la cédula ${doc} en el directorio activo.` };
      return { ok: false, mensaje: `El directorio activo respondió con error (${respuesta.status}).` };
    }
    const perfil = extraerPerfil(await respuesta.json().catch(() => null));
    if (!perfil.documento && !perfil.nombres && !perfil.usuarioRed) return { ok: false, mensaje: `No hay un funcionario con la cédula ${doc} en el directorio activo.` };
    return { ok: true, perfil: { ...perfil, documento: perfil.documento ?? doc } };
  } catch {
    return { ok: false, mensaje: "No fue posible consultar el directorio activo. Intente de nuevo." };
  } finally {
    if (!tokenServicio) await cerrarSesionDirectorioActivo(token).catch(() => {});
  }
}

export async function listarDirectorioCompleto(tokenServicio?: string): Promise<{ ok: true; perfiles: PerfilDirectorio[] } | { ok: false; mensaje: string }> {
  const base = baseUrl();
  if (!base || !credencialesServicio()) return { ok: false, mensaje: "La conexión con el directorio activo no está configurada." };
  let token = tokenServicio;
  if (!token) {
    const sesion = await abrirSesionServicioDirectorio();
    if (!sesion.ok) return { ok: false, mensaje: sesion.mensaje };
    token = sesion.token;
  }
  try {
    const respuesta = await fetch(`${base}/${RUTA_DIRECTORIO}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(60000),
    });
    if (!respuesta.ok) return { ok: false, mensaje: `El directorio activo respondió con error (${respuesta.status}).` };
    const cuerpo = (await respuesta.json().catch(() => null)) as { data?: unknown } | null;
    const filas = Array.isArray(cuerpo?.data) ? cuerpo.data : [];
    const perfiles = filas
      .map((fila) => extraerPerfil(fila))
      .filter((p) => p.usuarioRed && (p.documento || p.nombres || p.apellidos || p.email));
    return { ok: true, perfiles };
  } catch {
    return { ok: false, mensaje: "No fue posible consultar el directorio activo. Intente de nuevo." };
  } finally {
    if (!tokenServicio) await cerrarSesionDirectorioActivo(token).catch(() => {});
  }
}

export async function consultarDirectorioPorUsuarioRed(usuarioRed: string, tokenServicio?: string): Promise<ResultadoConsultaDirectorio> {
  const red = usuarioRed.trim().toLowerCase();
  const base = baseUrl();
  if (!red) return { ok: false, mensaje: "Indique el usuario de red." };
  if (!base || !credencialesServicio()) return { ok: false, noDisponible: true, mensaje: "La conexión con el directorio activo no está configurada." };
  let token = tokenServicio;
  if (!token) {
    const sesion = await abrirSesionServicioDirectorio();
    if (!sesion.ok) return { ok: false, mensaje: sesion.mensaje };
    token = sesion.token;
  }
  try {
    const respuesta = await fetch(`${base}/${RUTA_DIRECTORIO}?samAccountName=${encodeURIComponent(red)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!respuesta.ok) return { ok: false, mensaje: `El directorio activo respondió con error (${respuesta.status}).` };
    const cuerpo = (await respuesta.json().catch(() => null)) as { data?: unknown } | null;
    const filas = Array.isArray(cuerpo?.data) ? cuerpo.data : [];
    const perfil = filas.map((f) => extraerPerfil(f)).find((p) => p.usuarioRed?.toLowerCase() === red);
    return perfil ? { ok: true, perfil } : { ok: false, mensaje: `No hay una cuenta ${red} en el directorio activo.` };
  } catch {
    return { ok: false, mensaje: "No fue posible consultar el directorio activo. Intente de nuevo." };
  } finally {
    if (!tokenServicio) await cerrarSesionDirectorioActivo(token).catch(() => {});
  }
}

function normalizarBusqueda(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export async function buscarEnDirectorio(texto: string, limite = 10): Promise<{ ok: true; perfiles: PerfilDirectorio[] } | { ok: false; mensaje: string }> {
  const consulta = normalizarBusqueda(texto);
  if (consulta.length < 3) return { ok: false, mensaje: "Escriba al menos 3 caracteres: cédula, usuario de red, nombre o correo." };
  const r = await listarDirectorioCompleto();
  if (!r.ok) return r;
  const palabras = consulta.split(/\s+/);
  const perfiles = r.perfiles.filter((p) => {
    const base = normalizarBusqueda([p.documento, p.usuarioRed, p.nombres, p.apellidos, p.nombreCompleto, p.email, p.telefono, p.celular].filter(Boolean).join(" "));
    return palabras.every((w) => base.includes(w));
  });
  return { ok: true, perfiles: perfiles.slice(0, limite) };
}
