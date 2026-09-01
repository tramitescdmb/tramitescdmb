import { db } from "@/lib/db";
import { uploadDocumento } from "@/lib/storage";

/**
 * Cliente de la interoperabilidad con VITAL (Ventanilla Integral de Trámites
 * Ambientales en Línea, MinAmbiente).
 *
 * Replica EXACTAMENTE cómo lo hace el sistema anterior (`sinca.cdmb.gov.co`):
 * no habla con VITAL directo, sino con un **proxy** (`.../api/vital`) que
 * reenvía por X-Road a MinAmbiente. Ver reference-vital-sinca1 en la memoria.
 *
 *   SPA → proxy Laravel (VITAL_API_URL) → servidor X-Road → VITAL (MADS-8003)
 *
 * Cada llamada lleva 3 headers de enrutamiento:
 *   X-Road-Url     el servicio X-Road de VITAL           (VITAL_XROAD_URL)
 *   X-Road-Client  la identidad X-Road de la CDMB        (VITAL_XROAD_CLIENT)
 *   X-Road-Token   Bearer <access_token> de `wsToken`
 *
 * Alcance: SOLO LECTURA. No se usan `wsSolicitudesEstado` / `wsSolicitudesRadicados`
 * / `wsNotificacionesEmail` (endpoints de escritura hacia VITAL).
 *
 * Este módulo usa Buffer/fetch de Node — solo se importa desde rutas API y
 * scripts, nunca desde el navegador ni desde el middleware.
 */

const API_URL = process.env.VITAL_API_URL?.trim().replace(/\/+$/, "");
const XROAD_URL = process.env.VITAL_XROAD_URL?.trim();
const XROAD_CLIENT = process.env.VITAL_XROAD_CLIENT?.trim();
const CLIENT_ID = process.env.VITAL_CLIENT_ID;
const CLIENT_SECRET = process.env.VITAL_CLIENT_SECRET;
const USERNAME = process.env.VITAL_USERNAME;
const PASSWORD = process.env.VITAL_PASSWORD;

// El proxy (`.../api/vital`) es una app Laravel/Sanctum: hay que estar logueado
// en ella (`/admin/login`) además de tener el token de VITAL. Se reutiliza la
// misma cuenta de servicio que SINCA salvo que se den credenciales propias.
const PROXY_USUARIO = process.env.VITAL_PROXY_USUARIO || process.env.SINCA_API_USUARIO;
const PROXY_PASSWORD = process.env.VITAL_PROXY_PASSWORD || process.env.SINCA_API_PASSWORD;
const proxyLoginUrl = () => (API_URL ? `${API_URL.replace(/\/vital$/, "")}/admin/login` : null);

export function vitalConfigurado(): boolean {
  return Boolean(API_URL && XROAD_URL && XROAD_CLIENT && CLIENT_ID && CLIENT_SECRET && USERNAME && PASSWORD && PROXY_USUARIO && PROXY_PASSWORD);
}

/**
 * Catálogo completo de trámites de VITAL (id → nombre), tal como lo expone el
 * proxy de la CDMB en `GET /api/vital/tipo-tramites`. Copiado el 2026-09-01 y
 * refrescable con `refrescarCatalogoTramites()` (lo corre el cron). Son ~117
 * categorías: VITAL usa estos mismos nombres en su portal, por eso se dejan
 * literales aunque algunos arrastren el código interno de versión del trámite.
 */
export const NOMBRE_TRAMITE_VITAL: Record<number, string> = {
  1: "DAA y/o TDR para EIA",
  2: "Licencia Ambiental.",
  4: "Aguas Subterraneas",
  5: "Solicitud TDR para EIA",
  6: "Quejas y Denuncias",
  7: "Liquidación Licencia Ambiental",
  8: "Reconocimiento como Tercero Interviniente",
  9: "Salvoconducto Único Nacional.",
  10: "Audiencia Pública - Ciudadano",
  11: "Liquidación de Permiso Ambiental",
  12: "Cesión de Derechos y Trámites",
  14: "Comuicación entre Autoridades",
  15: "Interponer Recurso de Reposición",
  17: "Salvoconducto Único Nacional - Renovación",
  18: "Salvoconducto Único Nacional - Removilización",
  23: "Aprovechamiento Forestal",
  24: "Solicitud incoder",
  27: "Sancionatorio",
  28: "Audiencia Pública Por Oficio",
  29: "Ministerio del Interior",
  30: "Concesión Aguas Subterráneas",
  31: "Concesión Aguas Superficiales",
  32: "Emisiones Atmosféricas FF",
  33: "Prospección y Exploración",
  34: "Vertimientos",
  35: "Enviar Información Soporte",
  36: "Solicitud de Información",
  37: "Generar Cobro",
  38: "Solicitud de Modificación LA",
  39: "Resumen EIA",
  40: "Certificado Parques",
  41: "Reporte de Contingencias",
  42: "Beneficios Tributarios",
  43: "Notificación electrónica",
  44: "Beneficio Tributario Renta",
  45: "Fuentes No Convencionales de E",
  46: "Prueba Dinamica",
  47: "Levantamiento de Veda",
  48: "Sustracción de Reserva",
  49: "Permiso de Ocupación de Cauce",
  50: "Aprobación Nacional MDL",
  51: "Aprobación Nacional PoA",
  52: "Autorización Entidad Coor POA",
  53: "Carta No-Objeción MDL",
  54: "Carta No-Objeción PoA",
  55: "Consideración Temprana MDL POA",
  56: "Permiso Recolección D 3016",
  57: "Permiso Recolección Indiv 1376",
  58: "Sistemas Recolección Selectiva",
  59: "Planes Devolución Pos consumo",
  60: "Registro REDD+",
  61: "Certificado Recoleccion Especi",
  62: "Permiso Filmacion Parques",
  63: "Reserva Natural Sociedad S",
  64: "Permiso Recolección Macro 1376",
  65: "MPM Plan de Manejo",
  67: "Acceso Recursos Genéticos",
  68: "Prueba Dinámica Automatico",
  69: "Estructuras de Comunicación",
  70: "Uso Racional de Bolsas",
  73: "Reporte Conti-Parcial / Final",
  74: "Reporte Actividad Recuperación",
  75: "Liquidacion Permisos",
  76: "Auto Liquidación",
  77: "Registro detergentes y jabones",
  78: "Adecuación Obras PNNCRSB",
  79: "Solicitud Consulta Previa",
  80: "Acreditación Laboratorios",
  81: "Cert. Ambientales Bolsas",
  82: "VITAL-FNCE Ley1715 Integración",
  83: "Permiso Elementos Marcaje",
  85: "Autorización Im-Expor no CITES",
  86: "Autorización Movimiento RESPEL",
  87: "Cambios Menores",
  88: "Gestión de Envases y Empaques",
  89: "Avance Sistema de Recolección",
  90: "ICA-Seguimiento-Agroquímicos",
  91: "368_Registro Programa Arqueolo",
  92: "366_Solicitud Cambio Mayor",
  93: "367_Solicitud Cambio Menor",
  94: "369_Presentación Comunicación",
  95: "370_Diagnóstico Arqueológico",
  96: "CERT EN MATERIA DE EMISIONES",
  97: "372_Informe Final",
  98: "373_Plan Manejo Arqueológico",
  99: "PAP-sol_aso_respues_subsanació",
  100: "375_Subsanación Cambio Menor",
  101: "376_Subsanación Informe Avance",
  102: "377_Subsanación Informe Final",
  103: "378_Subsanación Plan Manejo Ar",
  104: "SOL CERTIFICADO UTILIDAD COMUN",
  105: "371_Informe Avance",
  106: "VITAL_VERTIMIENTO_CUERPO_A",
  107: "348_VITAL_VERTIMIENTO_CUERPO_A",
  108: "Reg Plan Arqueología Preventiv",
  109: "351 Conce Aguas Superficiales",
  110: "VITAL_VERTIMIENTO_SUELO",
  111: "361_PROSPECCION_EXPLORACION_AG",
  112: "363_VITAL_CONCESION_AGUAS_SUBT",
  113: "365_PERMISO_OCUPACION_PLAYAS_C",
  114: "365_PER_OCUPA_PLA_CAU_LECHO",
  115: "395_Presentación Inform Cierre",
  116: "394_Subsanación Informe Cierre",
  117: "PLAGUICIDAS INFORME DE ACT",
  118: "382 APROVECHAMIENTO FORESTAL",
  119: "Reg Tenedor de Bienes Muebles",
  120: "PRESENTACIÓN INI SRS LLANTAS",
  121: "Solicitud Cert Orden 1.3.1",
  122: "411 Registro y gestión RAEE",
  123: "412 Envases y empaques",
  124: "ACTIVIDADES BAJO IMPACTO",
  125: "416Licencia Ambiental Temporal",
  126: "417 FUN SEGUIMIENTO AGROQUIMIC",
  127: "Certificación Habilitación CDA",
  128: "Permiso Ambiental Zoológicos",
  129: "Permiso Jardines Botánicos",
  130: "Permiso Aprovechamiento Fauna",
};

/**
 * Trámites que ya se confirmó que la identidad de la CDMB tiene con datos en
 * VITAL (probando `wsObtenerSolicitudes`). Son la semilla de la sincronización;
 * el resto del catálogo se incorpora solo cuando la exploración
 * (`descubrirTramitesNuevos`) encuentra solicitudes y lo guarda en `VitalTramite`.
 */
export const TRAMITES_VITAL_SEMILLA = [6, 23, 31, 33, 35, 38, 41, 73, 76, 110, 121];

/** @deprecated Nombre viejo; ahora la semilla no es "todo el catálogo". */
export const TRAMITES_VITAL_DISPONIBLES = TRAMITES_VITAL_SEMILLA;

/** Ids del catálogo completo de VITAL. */
export const IDS_CATALOGO_VITAL = Object.keys(NOMBRE_TRAMITE_VITAL).map(Number);

export function nombreTramiteVital(id: number): string {
  return NOMBRE_TRAMITE_VITAL[id] ? `(${id}) ${NOMBRE_TRAMITE_VITAL[id]}` : `Trámite ${id}`;
}

/** Trámites VITAL semilla de la sincronización (env `VITAL_TRAMITES`, coma-separado). */
export function tramitesVital(): number[] {
  const raw = process.env.VITAL_TRAMITES?.trim();
  if (!raw) return TRAMITES_VITAL_SEMILLA;
  const ids = raw.split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isFinite(n));
  return ids.length ? ids : TRAMITES_VITAL_SEMILLA;
}

/**
 * Lista de trámites a sincronizar: los conocidos (o los de `VITAL_TRAMITES`) más
 * los que la exploración haya descubierto en la tabla `VitalTramite`.
 */
export async function tramitesASincronizar(): Promise<number[]> {
  const detectados = await db.vitalTramite.findMany({ where: { activo: true }, select: { idTramite: true } });
  return [...new Set([...tramitesVital(), ...detectados.map((d) => d.idTramite)])].sort((a, b) => a - b);
}

async function registrarTramiteDescubierto(id: number, muestraActividad: string | null) {
  await db.vitalTramite.upsert({
    where: { idTramite: id },
    create: { idTramite: id, nombre: NOMBRE_TRAMITE_VITAL[id] ?? muestraActividad ?? null, ultimaRevision: new Date() },
    update: { activo: true, nombre: NOMBRE_TRAMITE_VITAL[id] ?? undefined, ultimaRevision: new Date() },
  });
}

/**
 * Prueba `wsObtenerSolicitudes` (rango 2010→ayer) sobre ids del catálogo de VITAL
 * que todavía no sincronizamos. Si alguno responde con solicitudes se agrega a
 * `VitalTramite` y entra a la sincronización diaria — así el catálogo se completa
 * solo con lo que la CDMB realmente tiene.
 *
 * - modo normal: `cantidad` ids por corrida, con cursor circular sobre el catálogo.
 * - `completo: true`: recorre TODO el catálogo pendiente de una vez (para un
 *   barrido inicial; puede tardar varios minutos).
 *
 * Devuelve los ids recién descubiertos.
 */
export async function descubrirTramitesNuevos(cantidad = 40, opts?: { completo?: boolean }): Promise<number[]> {
  if (!vitalConfigurado()) return [];
  const conocidos = new Set(await tramitesASincronizar());
  const pendientes = IDS_CATALOGO_VITAL.filter((id) => !conocidos.has(id)).sort((a, b) => a - b);
  if (pendientes.length === 0) return [];

  const desde = "2010-01-01";
  const hasta = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const nuevos: number[] = [];

  const probar = async (id: number) => {
    try {
      const p = await listarSolicitudes({ idTramite: id, fechaInicio: desde, fechaFin: hasta, registrosPeticion: 3 });
      if (p.length > 0) {
        await registrarTramiteDescubierto(id, p[0].nombreActividad ?? null);
        nuevos.push(id);
      }
    } catch {
      /* error de bus X-Road (no un "sin datos") — se reintenta en la próxima corrida */
    }
  };

  if (opts?.completo) {
    for (const id of pendientes) await probar(id);
    return nuevos;
  }

  const estado = await db.vitalDescubrimiento.upsert({ where: { id: "singleton" }, create: {}, update: {} });
  let cursor = pendientes.findIndex((id) => id >= estado.proximoId);
  if (cursor < 0) cursor = 0;

  const aProbar = Math.min(cantidad, pendientes.length);
  for (let i = 0; i < aProbar; i++) {
    await probar(pendientes[(cursor + i) % pendientes.length]);
  }

  const siguiente = pendientes[(cursor + aProbar) % pendientes.length] ?? 1;
  await db.vitalDescubrimiento.update({ where: { id: "singleton" }, data: { proximoId: siguiente } });
  return nuevos;
}

// --- Tokens: 1) sesión en el proxy Laravel  2) access_token de VITAL ---------

let proxyToken: string | null = null;
let tokenCache: { accessToken: string; expiraEn: number } | null = null;

async function obtenerProxyToken(forzar = false): Promise<string> {
  if (!forzar && proxyToken) return proxyToken;
  const url = proxyLoginUrl();
  if (!url || !PROXY_USUARIO || !PROXY_PASSWORD) throw new Error("Faltan credenciales del proxy (VITAL_PROXY_* / SINCA_API_*).");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ name: "web", email: PROXY_USUARIO, password: PROXY_PASSWORD }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const cuerpo = (await res.json().catch(() => null)) as { token?: string; message?: string } | null;
  if (!res.ok || !cuerpo?.token) {
    throw new Error(`No se pudo iniciar sesión en el proxy de VITAL (HTTP ${res.status}): ${cuerpo?.message ?? "sin detalle"}`);
  }
  proxyToken = cuerpo.token;
  return proxyToken;
}

async function obtenerToken(forzar = false): Promise<string> {
  if (!vitalConfigurado()) {
    throw new Error("La integración con VITAL no está configurada (faltan variables VITAL_*).");
  }
  const ahora = Date.now();
  if (!forzar && tokenCache && tokenCache.expiraEn - 30_000 > ahora) return tokenCache.accessToken;

  const pedir = async (proxy: string) =>
    fetch(`${API_URL}/wsToken`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Bearer ${proxy}`,
        "X-Road-Url": XROAD_URL!,
        "X-Road-Client": XROAD_CLIENT!,
      },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        username: USERNAME!,
        password: PASSWORD!,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });

  let res = await pedir(await obtenerProxyToken(forzar));
  if (res.status === 401) {
    proxyToken = null;
    res = await pedir(await obtenerProxyToken(true));
  }

  const data = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; message?: string } | null;
  if (!res.ok || !data?.access_token) {
    throw new Error(`No se pudo autenticar contra VITAL (HTTP ${res.status}): ${data?.message ?? "sin detalle"}`);
  }
  tokenCache = { accessToken: data.access_token, expiraEn: ahora + (Number(data.expires_in) || 300) * 1000 };
  return tokenCache.accessToken;
}

// --- Llamada genérica a un servicio ws* -------------------------------------

function mensajeError(cuerpo: unknown): string {
  if (!cuerpo || typeof cuerpo !== "object") return "error desconocido";
  const o = cuerpo as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    if (!/^mensajeError/i.test(k)) continue;
    const v = o[k];
    if (Array.isArray(v)) return v.join(" · ");
    if (v && typeof v === "object") return String(Object.values(v)[0] ?? "");
    if (typeof v === "string") return v;
  }
  return (typeof o.message === "string" && o.message) || `HTTP`;
}

async function vitalPost<T>(ws: string, body: Record<string, unknown>, extraHeaders?: Record<string, string>): Promise<T> {
  if (!API_URL) throw new Error("VITAL_API_URL no está configurado.");

  const hacer = async (proxy: string, vitalTok: string) =>
    fetch(`${API_URL}${ws}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${proxy}`,
        "X-Road-Url": XROAD_URL!,
        "X-Road-Client": XROAD_CLIENT!,
        "X-Road-Token": `Bearer ${vitalTok}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });

  let res = await hacer(await obtenerProxyToken(), await obtenerToken());
  if (res.status === 401) {
    proxyToken = null;
    res = await hacer(await obtenerProxyToken(true), await obtenerToken(true));
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!res.ok) throw new Error(`VITAL ${ws}: HTTP ${res.status}`);
    return (await res.arrayBuffer()) as unknown as T; // p. ej. /descargar devuelve un blob
  }
  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`VITAL ${ws}: ${mensajeError(cuerpo)}`);
  return cuerpo as T;
}

/**
 * VITAL responde "El campo id_tramite no se relaciona con un tramite de la
 * autoridad ambiental autenticada" cuando NO hay solicitudes de ese trámite en
 * el rango (aparece incluso para trámites que sí tenemos, en años sin
 * movimiento). Es una respuesta definitiva: no se reintenta y se trata como
 * lista vacía, no como error.
 */
const SIN_DATOS_VITAL = /no se relaciona con un tramite|no se relaciona con el tramite|sin resultados|no se encontr/i;

/**
 * El bus X-Road de VITAL es intermitente: la misma llamada a veces devuelve
 * datos y a veces se cae o da timeout. Se reintenta salvo que la respuesta sea
 * el "sin datos" de arriba, que es definitivo.
 */
async function vitalPostReintentando<T>(ws: string, body: Record<string, unknown>, intentos = 3): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await vitalPost<T>(ws, body);
    } catch (err) {
      ultimo = err;
      if (err instanceof Error && SIN_DATOS_VITAL.test(err.message)) throw err;
      if (i < intentos - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw ultimo;
}

// --- Servicios de lectura --------------------------------------------------

export type SolicitudVitalResumen = {
  idVital: string;
  idTramite: number;
  idTramiteAutoridad: number | null;
  FechaRadicacion: string | null;
  nombreActividad: string | null;
};

/** wsObtenerSolicitudes — lista de solicitudes de un trámite en un rango de fechas. */
export async function listarSolicitudes(opts: {
  idTramite: number;
  fechaInicio: string; // AAAA-MM-DD
  fechaFin: string; // AAAA-MM-DD
  indiceRegistroInicial?: number;
  registrosPeticion?: number;
}): Promise<SolicitudVitalResumen[]> {
  let data: unknown;
  try {
    data = await vitalPostReintentando<unknown>("/wsObtenerSolicitudes", {
      id_tramite: opts.idTramite,
      fecha_inicio: opts.fechaInicio,
      fecha_fin: opts.fechaFin,
      indice_registro_inicial: opts.indiceRegistroInicial ?? 0,
      registros_peticion: opts.registrosPeticion ?? 50,
    });
  } catch (err) {
    if (err instanceof Error && SIN_DATOS_VITAL.test(err.message)) return []; // no hay solicitudes en el rango
    throw err;
  }
  const arr = Array.isArray(data) ? data : ((data as { solicitudes?: unknown[]; data?: unknown[] })?.solicitudes ?? (data as { data?: unknown[] })?.data ?? []);
  return (arr as Record<string, unknown>[]).map((r) => ({
    idVital: String(r.idVital ?? r.id_vital ?? ""),
    idTramite: Number(r.idTramite ?? r.id_tramite ?? opts.idTramite),
    idTramiteAutoridad: r.idTramiteAutoridad != null ? Number(r.idTramiteAutoridad) : null,
    FechaRadicacion: (r.fechaRadicacion ?? r.FechaRadicacion ?? null) as string | null,
    nombreActividad: (r.nombreActividad ?? null) as string | null,
  })).filter((r) => r.idVital);
}

/** wsSolicitudes — campos del formulario diligenciado por el ciudadano. */
async function consultarCamposSolicitud(idVital: string): Promise<unknown> {
  const data = await vitalPostReintentando<{ campotramite?: unknown; campoTramite?: unknown; camposTramite?: unknown }>("/wsSolicitudes", { id_vital: idVital });
  return data?.campotramite ?? data?.campoTramite ?? data?.camposTramite ?? data;
}

/** wsSolicitante — datos del solicitante (VITAL devuelve un arreglo de interesados). */
async function consultarSolicitante(idVital: string): Promise<Record<string, unknown>[] | null> {
  const data = await vitalPostReintentando<unknown>("/wsSolicitante", { id_vital: idVital });
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") return [data as Record<string, unknown>];
  return null;
}

type DocumentoVital = { nombre_archivo: string; url_archivo: string };

/** wsDocumentos — documentos adjuntos (la url_archivo es un recurso X-Road, no una URL pública). */
async function consultarDocumentos(idVital: string): Promise<DocumentoVital[]> {
  const data = await vitalPostReintentando<{ listaDocumentos?: DocumentoVital[]; lista_documentos?: DocumentoVital[] }>("/wsDocumentos", { id_vital: idVital });
  return (data?.listaDocumentos ?? data?.lista_documentos ?? []).filter((d) => d?.url_archivo);
}

/** POST /descargar con X-Road-Url = url_archivo → devuelve el archivo. */
async function descargarDocumentoVital(urlArchivo: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    if (!API_URL) return null;
    const res = await fetch(`${API_URL}/descargar`, {
      method: "POST",
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${await obtenerProxyToken()}`,
        "X-Road-Url": urlArchivo,
        "X-Road-Client": XROAD_CLIENT!,
        "X-Road-Token": `Bearer ${await obtenerToken()}`,
      },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "application/octet-stream";
    if (ct.includes("application/json")) return null; // vino un error, no un archivo
    return { buffer: Buffer.from(await res.arrayBuffer()), mimeType: ct };
  } catch {
    return null;
  }
}

// --- Sincronización -------------------------------------------------------

function nombreDe(info: Record<string, unknown>): string | null {
  const razon = info.razonSocial ?? info.razon_social;
  if (typeof razon === "string" && razon) return razon;
  const partes = [info.primerNombre ?? info.primer_nombre, info.segundoNombre ?? info.segundo_nombre, info.primerApellido ?? info.primer_apellido, info.segundoApellido ?? info.segundo_apellido]
    .filter((p): p is string => typeof p === "string" && p.length > 0);
  return partes.length ? partes.join(" ") : null;
}
function identificacionDe(info: Record<string, unknown>): string | null {
  const v = info.numeroIdentificacion ?? info.numero_identificacion ?? info["número_identificacion"];
  return v != null ? String(v) : null;
}
function correoDe(info: Record<string, unknown>): string | null {
  const v = info.correoElectronico ?? info.correo_electronico ?? info.correo;
  return typeof v === "string" && v ? v : null;
}

/** Trae y guarda (upsert) UNA solicitud: campos + solicitante + documentos nuevos. */
export async function sincronizarSolicitud(resumen: SolicitudVitalResumen) {
  const [campos, solicitantes, documentos] = await Promise.all([
    consultarCamposSolicitud(resumen.idVital).catch(() => null),
    consultarSolicitante(resumen.idVital).catch(() => null),
    consultarDocumentos(resumen.idVital).catch(() => [] as DocumentoVital[]),
  ]);

  const principal = solicitantes?.[0] ?? null;

  const solicitud = await db.solicitudVital.upsert({
    where: { idVital: resumen.idVital },
    create: {
      idVital: resumen.idVital,
      idTramiteVital: resumen.idTramite,
      idTramiteAutoridad: resumen.idTramiteAutoridad,
      fechaRadicacion: resumen.FechaRadicacion ? new Date(resumen.FechaRadicacion) : null,
      nombreActividad: resumen.nombreActividad,
      solicitanteNombre: principal ? nombreDe(principal) : null,
      solicitanteIdentificacion: principal ? identificacionDe(principal) : null,
      solicitanteCorreo: principal ? correoDe(principal) : null,
      solicitanteRaw: (solicitantes as unknown as object) ?? undefined,
      camposTramite: (campos as object | null) ?? undefined,
    },
    update: {
      idTramiteAutoridad: resumen.idTramiteAutoridad ?? undefined,
      fechaRadicacion: resumen.FechaRadicacion ? new Date(resumen.FechaRadicacion) : undefined,
      nombreActividad: resumen.nombreActividad,
      solicitanteNombre: principal ? nombreDe(principal) : undefined,
      solicitanteIdentificacion: principal ? identificacionDe(principal) : undefined,
      solicitanteCorreo: principal ? correoDe(principal) : undefined,
      solicitanteRaw: (solicitantes as unknown as object) ?? undefined,
      camposTramite: (campos as object | null) ?? undefined,
    },
  });

  const existentes = await db.solicitudVitalDocumento.findMany({ where: { solicitudId: solicitud.id }, select: { nombre: true } });
  const yaTengo = new Set(existentes.map((d) => d.nombre));

  for (const doc of documentos) {
    if (yaTengo.has(doc.nombre_archivo)) continue;
    const archivo = await descargarDocumentoVital(doc.url_archivo);
    if (!archivo) continue;
    const safeName = doc.nombre_archivo.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `vital/${resumen.idVital}/${Date.now()}-${safeName}`;
    try {
      await uploadDocumento(path, archivo.buffer, archivo.mimeType);
      await db.solicitudVitalDocumento.create({
        data: { solicitudId: solicitud.id, nombre: doc.nombre_archivo, storagePath: path, mimeType: archivo.mimeType, tamanoBytes: archivo.buffer.length },
      });
    } catch {
      /* un documento puntual que falle no aborta el resto */
    }
  }

  return solicitud;
}

/** Sincroniza TODAS las solicitudes de un trámite en un rango, paginando de a 50. */
export async function sincronizarTramite(opts: {
  idTramite: number;
  fechaInicio: string;
  fechaFin: string;
}): Promise<{ total: number; errores: string[] }> {
  const errores: string[] = [];
  let total = 0;
  const tam = 50;

  for (let indice = 0; ; indice += tam) {
    const pagina = await listarSolicitudes({
      idTramite: opts.idTramite,
      fechaInicio: opts.fechaInicio,
      fechaFin: opts.fechaFin,
      indiceRegistroInicial: indice,
      registrosPeticion: tam,
    });
    if (pagina.length === 0) break;

    for (const resumen of pagina) {
      try {
        await sincronizarSolicitud(resumen);
        total++;
      } catch (err) {
        errores.push(`${resumen.idVital}: ${err instanceof Error ? err.message : "error"}`);
      }
    }
    if (pagina.length < tam) break;
  }
  return { total, errores };
}
