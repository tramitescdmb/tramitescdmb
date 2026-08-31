/**
 * Cliente del API de SINCA 1.0 (Laravel + Sanctum), endpoint
 * `GET /api/presinca/resoluciones` — histórico de trámites ambientales con
 * resolución de fondo.
 *
 * Este módulo NO se usa desde el navegador ni desde el middleware: solo desde
 * la sincronización (src/lib/sinca-sync.ts) y, si hiciera falta, desde rutas
 * API en Node.
 *
 * Autenticación: cuenta de servicio fija. Hace `POST /admin/login` una vez y
 * reutiliza el token (Sanctum) mientras el proceso viva; si el API responde
 * 401 se descarta y se vuelve a autenticar una vez.
 *
 * Variables de entorno:
 *   SINCA_API_URL       URL base sin barra final. Ej.: http://168.90.14.182/api
 *   SINCA_API_CLIENTE   Campo `name` del login (web|app|postman|desktop). Def. "web".
 *   SINCA_API_USUARIO   Usuario de la cuenta de servicio.
 *   SINCA_API_PASSWORD  Contraseña de la cuenta de servicio.
 */

function baseUrl() {
  return process.env.SINCA_API_URL?.trim().replace(/\/+$/, "") || null;
}

export function sincaConfigurado() {
  return baseUrl() !== null && !!process.env.SINCA_API_USUARIO && !!process.env.SINCA_API_PASSWORD;
}

let tokenEnMemoria: string | null = null;

async function autenticar(): Promise<string> {
  const base = baseUrl();
  if (!base) throw new Error("SINCA_API_URL no está configurado.");
  const usuario = process.env.SINCA_API_USUARIO;
  const password = process.env.SINCA_API_PASSWORD;
  if (!usuario || !password) throw new Error("SINCA_API_USUARIO / SINCA_API_PASSWORD no están configurados.");

  const res = await fetch(`${base}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      name: process.env.SINCA_API_CLIENTE?.trim() || "web",
      email: usuario,
      password,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const cuerpo = (await res.json().catch(() => null)) as { token?: string; message?: string } | null;
  if (!res.ok || !cuerpo?.token) {
    throw new Error(`No se pudo autenticar contra SINCA 1.0 (${res.status}): ${cuerpo?.message ?? "sin detalle"}`);
  }
  tokenEnMemoria = cuerpo.token;
  return cuerpo.token;
}

async function fetchConToken(path: string): Promise<Response> {
  const base = baseUrl();
  if (!base) throw new Error("SINCA_API_URL no está configurado.");
  const token = tokenEnMemoria ?? (await autenticar());

  const hacer = (t: string) =>
    fetch(`${base}${path}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${t}` },
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });

  let res = await hacer(token);
  if (res.status === 401) {
    tokenEnMemoria = null;
    res = await hacer(await autenticar());
  }
  return res;
}

// --- Tipos del API -----------------------------------------------------------

type Etiquetado = { label: string | null; value: string | null } | null;

export type SincaResolucionApi = {
  rn: string;
  numero_resolucion: string | null;
  fecha_documento: string | null;
  nrosolicitud_sol: number;
  fecharecibido_sol?: string | null;
  tipo_solicitud: string | null;
  proyecto_sol: string | null;
  indtiposol_sol: Etiquetado;
  estado_sol: Etiquetado;
  origen_sol?: Etiquetado;
  expediente_sol: string | null;
  departamento: string | null;
  municipio: string | null;
  barrio: string | null;
  correo_sol: string | null;
  replegal_sol: string | null;
  idreplegal_sol: number | string | null;
  cantidad_emision_documentos: string | number | null;
  cantidad_interesado: string | number | null;
  geojson_GMS: { type: string; coordinates: [number, number] } | null;
  [k: string]: unknown;
};

type PaginadorApi<T> = {
  current_page: number;
  data: T[];
  last_page: number;
  per_page: number;
  total: number;
};

export type OpcionesListado = {
  perPage?: number;
  page?: number;
  column?: string;
  order?: "ASC" | "DESC";
  search?: string;
  numeroSolicitud?: number;
  expediente?: string;
};

/**
 * Una página de `GET /api/presinca/resoluciones`. El API acepta hasta ~1000
 * registros por página en este endpoint.
 */
export async function listarResoluciones(opts: OpcionesListado = {}): Promise<PaginadorApi<SincaResolucionApi>> {
  const params = new URLSearchParams({
    per_page: String(opts.perPage ?? 200),
    page: String(opts.page ?? 1),
    column: opts.column ?? "nrosolicitud_sol",
    order: opts.order ?? "DESC",
  });
  if (opts.search) params.set("search", opts.search);
  if (opts.numeroSolicitud) params.set("numero_solicitud", String(opts.numeroSolicitud));
  if (opts.expediente) params.set("expediente", opts.expediente);

  const res = await fetchConToken(`/presinca/resoluciones?${params.toString()}`);
  const cuerpo = (await res.json().catch(() => null)) as PaginadorApi<SincaResolucionApi> | { message?: string } | null;

  if (!res.ok || !cuerpo || !("data" in cuerpo)) {
    const msg = (cuerpo as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
    throw new Error(`SINCA 1.0 /presinca/resoluciones falló: ${msg}`);
  }
  return cuerpo;
}
