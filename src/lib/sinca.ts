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

// --- Detalle de una resolución --------------------------------------------------
// `GET /presinca/resoluciones/{nrosolicitud_sol}` devuelve bastante más que el
// listado: los documentos emitidos (incl. la resolución de fondo) y el interesado.

export type SincaDocumentoEmitido = {
  fechaemision_edc: string | null;
  fechavigencia_edc: string | null;
  fechadocumento_edc: string | null;
  fechanotificacion_edc: string | null;
  nrodocumento_edc: string | null;
  referencia_edc: string | null;
  foliosdoc_edc: number | null;
  caminopdf_edc: string | null; // ruta del archivo en el servidor de la CDMB (no es una URL)
  edc_caminodoc_edc: string | null;
  caminodoc_edc: string | null;
  idempleadoelabora_emp: string | number | null;
  tipoubicacionpdf_edc: Etiquetado;
  inddefinitivo_edc: Etiquetado;
  abogadodoc_edc: Etiquetado;
  notificadorpdf_edc: Etiquetado;
  documentos_cdmb: {
    nombre_dcc: string | null;
    tipodoc_dcc: Etiquetado;
    requierenotif_dcc: Etiquetado;
    esmotivado_dcc: Etiquetado;
    indnumeracion_dcc: Etiquetado;
    consecutivo_dcc: string | number | null;
  } | null;
  [k: string]: unknown;
};

export type SincaResolucionDetalleApi = {
  nrosolicitud_sol: number;
  nrosolresol_sol: string | null;
  nroorigen_sol: number | string | null;
  anoorigen_sol: number | string | null;
  proyecto_sol: string | null;
  observacion_sol: string | null;
  descripsitio_sol: string | null;
  direccion_sol: string | null;
  telefono_sol: string | null;
  correo_sol: string | null;
  fecharecibido_sol: string | null;
  feregistro_sol: string | null;
  expediente_sol: string | null;
  estado_sol: Etiquetado;
  indtiposol_sol: Etiquetado;
  origen_sol: Etiquetado;
  requierepermiso_sol: Etiquetado;
  licenciaunica_sol: Etiquetado;
  tipoproyecto_sol: Etiquetado;
  tipocenpoblado_sol: Etiquetado;
  clasesuelo_sol: Etiquetado;
  usosuelo_sol: Etiquetado;
  nrotitulomin_tmi: string | number | null;
  nroviviendas_sol: number | string | null;
  nropredios_sol: number | string | null;
  area_sol: number | string | null;
  usuariocrea_sol: string | null;
  municipios: { nombre_mun: string | null; departamentos: { nombre_dpt: string | null } | null } | null;
  vereda: string | null;
  barrio: string | null;
  tipo_solicitud: { tiposol_tps: string | null; nombretipo_tps: string | null; tipotramite_tps: string | null; tiempo_dias_tps: string | number | null } | null;
  interesado: { fechadesde_int?: string | null; nit: SincaNit | null }[] | null;
  emision_documentos: SincaDocumentoEmitido[] | null;
  [k: string]: unknown;
};

export type SincaNit = {
  numero_nit?: number | string | null;
  digito_nit?: number | string | null;
  nombre_nit?: string | null;
  razon_soc_nit?: string | null;
  primer_nom_nit?: string | null;
  segundo_nom_nit?: string | null;
  primer_ape_nit?: string | null;
  segundo_ape_nit?: string | null;
  direcc_nit?: string | null;
  telef_nit?: string | null;
  celular_nit?: string | null;
  correo_nit?: string | null;
  tipo_nit?: Etiquetado;
  natur_jurid_nit?: Etiquetado;
  regimen_nit?: Etiquetado;
  clase_nit?: string | null;
  gcontri_nit?: Etiquetado | string | null;
  autoret_nit?: Etiquetado | string | null;
  fechaact_nit?: string | null;
  usuarioact_nit?: string | null;
  id_user_nit?: string | null;
  clave_ser?: string | null;
  municipios?: { nombre_mun?: string | null; departamentos?: { nombre_dpt?: string | null } | null } | null;
  municipios_dom?: { nombre_mun?: string | null; departamentos?: { nombre_dpt?: string | null } | null } | null;
  [k: string]: unknown;
};

/** `null` si el API responde 404 para ese número de solicitud. */
export async function obtenerResolucionDetalle(nroSolicitud: number): Promise<SincaResolucionDetalleApi | null> {
  const res = await fetchConToken(`/presinca/resoluciones/${nroSolicitud}`);
  if (res.status === 404) return null;
  const cuerpo = (await res.json().catch(() => null)) as { data?: SincaResolucionDetalleApi; message?: string } | null;
  if (!res.ok || !cuerpo?.data) {
    throw new Error(`SINCA 1.0 /presinca/resoluciones/${nroSolicitud} falló: ${cuerpo?.message ?? `HTTP ${res.status}`}`);
  }
  return cuerpo.data;
}

export type ArchivoResolucion =
  | { ok: true; datos: ArrayBuffer; contentType: string; nombre: string }
  | { ok: false; estado: number; mensaje: string };

/**
 * Descarga el archivo (PDF/imagen/Word) de un documento de la resolución.
 * `POST /presinca/resoluciones/file` con `{ ruta: <caminopdf_edc> }` — la misma
 * llamada que hace el sistema anterior. `ruta` es una ruta de archivo en el
 * servidor documental de la CDMB (ej. `N:\solNNNN_DocJur3_de_YYYYMMDD.pdf`), no
 * una URL; el backend la resuelve contra su unidad de red. Si esa unidad no es
 * alcanzable desde donde corre el API, responde 400 "No existe archivo".
 */
export async function descargarArchivoResolucion(ruta: string): Promise<ArchivoResolucion> {
  const base = process.env.SINCA_API_URL?.trim().replace(/\/+$/, "");
  if (!base) return { ok: false, estado: 503, mensaje: "SINCA 1.0 no está configurado." };

  const hacer = async (token: string) =>
    fetch(`${base}/presinca/resoluciones/file`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ruta }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });

  let token = tokenEnMemoria ?? (await autenticar());
  let res = await hacer(token);
  if (res.status === 401) {
    tokenEnMemoria = null;
    token = await autenticar();
    res = await hacer(token);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || contentType.includes("application/json")) {
    let mensaje = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string };
      if (j?.message) mensaje = j.message;
    } catch {
      /* noop */
    }
    return { ok: false, estado: res.status === 200 ? 502 : res.status, mensaje };
  }

  const nombre = ruta.split(/[\\/]/).pop() || "documento";
  return { ok: true, datos: await res.arrayBuffer(), contentType: contentType || "application/octet-stream", nombre };
}
