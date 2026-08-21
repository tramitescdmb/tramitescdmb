import { db } from "@/lib/db";
import { uploadDocumento } from "@/lib/storage";

/**
 * Cliente de la interoperabilidad VITAL/OTIC (MinAmbiente), expuesta vía
 * X-ROAD. Basado en las historias de usuario hu-otic-vital-io-001 a 004 y
 * 009 (documentación de campos, no un Swagger real) — las RUTAS exactas de
 * cada servicio son la parte que más probablemente haya que ajustar una vez
 * se pruebe contra el ambiente real; los nombres de los parámetros y de los
 * campos de respuesta sí vienen directo de esas historias de usuario.
 *
 * Alcance actual: solo lectura (traer solicitudes hacia esta plataforma).
 * Las historias 005/006/007/008 (reportar avance, asociar radicado,
 * notificar) quedaron explícitamente fuera de alcance por ahora.
 */

const VITAL_TOKEN_URL = process.env.VITAL_TOKEN_URL;
const VITAL_BASE_URL = process.env.VITAL_BASE_URL;
const VITAL_CLIENT_ID = process.env.VITAL_CLIENT_ID;
const VITAL_CLIENT_SECRET = process.env.VITAL_CLIENT_SECRET;
const VITAL_USERNAME = process.env.VITAL_USERNAME;
const VITAL_PASSWORD = process.env.VITAL_PASSWORD;

export function vitalConfigurado(): boolean {
  return Boolean(
    VITAL_TOKEN_URL && VITAL_BASE_URL && VITAL_CLIENT_ID && VITAL_CLIENT_SECRET && VITAL_USERNAME && VITAL_PASSWORD
  );
}

// El token dura 300s (hu-otic-vital-io-009) — se cachea en memoria del proceso
// mientras dure una sincronización; en frío simplemente se pide uno nuevo.
let tokenCache: { accessToken: string; expiraEn: number } | null = null;

async function obtenerToken(): Promise<string> {
  if (!vitalConfigurado()) {
    throw new Error("La integración con VITAL no está configurada (faltan variables de entorno VITAL_*).");
  }

  const ahora = Date.now();
  if (tokenCache && tokenCache.expiraEn - 30_000 > ahora) {
    return tokenCache.accessToken;
  }

  const res = await fetch(VITAL_TOKEN_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: VITAL_CLIENT_ID!,
      client_secret: VITAL_CLIENT_SECRET!,
      username: VITAL_USERNAME!,
      password: VITAL_PASSWORD!,
    }),
  });

  if (!res.ok) {
    const texto = await res.text().catch(() => "");
    throw new Error(`No se pudo obtener el token de VITAL (HTTP ${res.status}): ${texto.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("VITAL respondió sin access_token — revisa client_id/client_secret/username/password.");
  }

  tokenCache = {
    accessToken: data.access_token,
    expiraEn: ahora + (Number(data.expires_in) || 300) * 1000,
  };
  return tokenCache.accessToken;
}

async function vitalFetch(path: string, params: Record<string, string | number>): Promise<any> {
  const token = await obtenerToken();
  const url = new URL(path, VITAL_BASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = data?.mensaje_error || data?.error_description || `HTTP ${res.status}`;
    throw new Error(`VITAL (${path}): ${msg}`);
  }
  return data;
}

export type SolicitudVitalResumen = {
  idVital: string;
  idTramite: number;
  idTramiteAutoridad: number | null;
  FechaRadicacion: string | null;
  nombreActividad: string | null;
};

/** hu-otic-vital-io-001 — lista de solicitudes activas, paginada de a máx. 50. */
export async function listarSolicitudes(opts: {
  idTramite: number;
  fechaInicio: string; // AAAA-MM-DD
  fechaFin: string; // AAAA-MM-DD
  indiceRegistroInicial?: number;
  registrosPeticion?: number;
}): Promise<SolicitudVitalResumen[]> {
  const data = await vitalFetch("/solicitudes", {
    id_tramite: opts.idTramite,
    fecha_inicio: opts.fechaInicio,
    fecha_fin: opts.fechaFin,
    indice_registro_inicial: opts.indiceRegistroInicial ?? 0,
    registros_peticion: opts.registrosPeticion ?? 50,
  });
  return Array.isArray(data) ? data : (data?.solicitudes ?? data?.data ?? []);
}

/** hu-otic-vital-io-002 — campos del formulario diligenciados por el ciudadano. */
async function consultarCamposSolicitud(idVital: string): Promise<unknown> {
  const data = await vitalFetch(`/solicitudes/${encodeURIComponent(idVital)}/campos`, {});
  return data?.camposTramite ?? data;
}

/** hu-otic-vital-io-003 — datos del solicitante (persona natural o jurídica). */
async function consultarSolicitante(idVital: string): Promise<Record<string, unknown> | null> {
  return vitalFetch(`/solicitudes/${encodeURIComponent(idVital)}/solicitante`, {});
}

type DocumentoVital = { nombre_archivo: string; url_archivo: string };

/** hu-otic-vital-io-004 — documentos adjuntos: la URL de descarga solo vive 1 hora. */
async function consultarDocumentos(idVital: string): Promise<DocumentoVital[]> {
  const data = await vitalFetch(`/solicitudes/${encodeURIComponent(idVital)}/documentos`, {});
  return data?.listaDocumentos ?? data?.lista_documentos ?? [];
}

function buildVitalStoragePath(idVital: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `vital/${idVital}/${Date.now()}-${safeName}`;
}

function extraerNombreSolicitante(info: Record<string, unknown>): string | null {
  if (typeof info.razon_social === "string" && info.razon_social) return info.razon_social;
  const partes = [info.primer_nombre, info.segundo_nombre, info.primer_apellido, info.segundo_apellido].filter(
    (p): p is string => typeof p === "string" && p.length > 0
  );
  return partes.length ? partes.join(" ") : null;
}

function extraerIdentificacion(info: Record<string, unknown>): string | null {
  const valor = info.numero_identificacion ?? info["número_identificacion"];
  return typeof valor === "string" ? valor : null;
}

/** Trae y guarda (upsert) UNA solicitud completa: campos + solicitante + documentos nuevos. */
export async function sincronizarSolicitud(resumen: SolicitudVitalResumen) {
  const [campos, solicitante, documentos] = await Promise.all([
    consultarCamposSolicitud(resumen.idVital).catch(() => null),
    consultarSolicitante(resumen.idVital).catch(() => null),
    consultarDocumentos(resumen.idVital).catch(() => [] as DocumentoVital[]),
  ]);

  const nombreSolicitante = solicitante ? extraerNombreSolicitante(solicitante) : null;
  const identificacion = solicitante ? extraerIdentificacion(solicitante) : null;
  const correo = solicitante && typeof solicitante.correo_electronico === "string" ? solicitante.correo_electronico : null;

  const solicitud = await db.solicitudVital.upsert({
    where: { idVital: resumen.idVital },
    create: {
      idVital: resumen.idVital,
      idTramiteVital: resumen.idTramite,
      idTramiteAutoridad: resumen.idTramiteAutoridad,
      fechaRadicacion: resumen.FechaRadicacion ? new Date(resumen.FechaRadicacion) : null,
      nombreActividad: resumen.nombreActividad,
      solicitanteNombre: nombreSolicitante,
      solicitanteIdentificacion: identificacion,
      solicitanteCorreo: correo,
      solicitanteRaw: (solicitante as object | null) ?? undefined,
      camposTramite: (campos as object | null) ?? undefined,
    },
    update: {
      nombreActividad: resumen.nombreActividad,
      solicitanteNombre: nombreSolicitante,
      solicitanteIdentificacion: identificacion,
      solicitanteCorreo: correo,
      solicitanteRaw: (solicitante as object | null) ?? undefined,
      camposTramite: (campos as object | null) ?? undefined,
    },
  });

  // Solo se descargan documentos que todavía no tenemos (por nombre) — evita re-bajar en cada sincronización.
  const existentes = await db.solicitudVitalDocumento.findMany({
    where: { solicitudId: solicitud.id },
    select: { nombre: true },
  });
  const nombresExistentes = new Set(existentes.map((d) => d.nombre));

  for (const doc of documentos) {
    if (nombresExistentes.has(doc.nombre_archivo)) continue;
    try {
      const res = await fetch(doc.url_archivo);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      const mimeType = res.headers.get("content-type") || "application/octet-stream";
      const path = buildVitalStoragePath(resumen.idVital, doc.nombre_archivo);
      await uploadDocumento(path, buffer, mimeType);
      await db.solicitudVitalDocumento.create({
        data: {
          solicitudId: solicitud.id,
          nombre: doc.nombre_archivo,
          storagePath: path,
          mimeType,
          tamanoBytes: buffer.length,
        },
      });
    } catch {
      // Si un documento puntual falla (ej. la URL de 1h ya venció), se sigue con los demás.
    }
  }

  return solicitud;
}

/** Sincroniza TODAS las solicitudes de un trámite VITAL en un rango de fechas, paginando de a 50. */
export async function sincronizarTramite(opts: {
  idTramite: number;
  fechaInicio: string;
  fechaFin: string;
}): Promise<{ total: number; errores: string[] }> {
  const errores: string[] = [];
  let total = 0;
  let indice = 0;
  const tamanoPagina = 50;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pagina = await listarSolicitudes({
      idTramite: opts.idTramite,
      fechaInicio: opts.fechaInicio,
      fechaFin: opts.fechaFin,
      indiceRegistroInicial: indice,
      registrosPeticion: tamanoPagina,
    });
    if (pagina.length === 0) break;

    for (const resumen of pagina) {
      try {
        await sincronizarSolicitud(resumen);
        total++;
      } catch (err) {
        errores.push(`${resumen.idVital}: ${err instanceof Error ? err.message : "error desconocido"}`);
      }
    }

    if (pagina.length < tamanoPagina) break;
    indice += tamanoPagina;
  }

  return { total, errores };
}
