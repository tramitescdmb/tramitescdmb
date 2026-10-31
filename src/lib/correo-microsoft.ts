import { db } from "@/lib/db";
import { descifrarSecreto } from "@/lib/cifrado-config";

type Credencial = { clave: string; tenantId: string; clientId: string; clientSecret: string };
type Configuracion = { cuentaId: string | null; remitente: string; credenciales: Credencial[] };

function configuracionEntorno(): Configuracion | null {
  const tenantId = process.env.MS_TENANT_ID?.trim();
  const clientId = process.env.MS_CLIENT_ID?.trim();
  const clientSecret = process.env.MS_CLIENT_SECRET?.trim();
  const remitente = process.env.MS_CORREO_REMITENTE?.trim().toLowerCase();
  return tenantId && clientId && clientSecret && remitente ? { cuentaId: null, remitente, credenciales: [{ clave: "entorno", tenantId, clientId, clientSecret }] } : null;
}

const VIGENCIA_CONFIGURACION_MS = 60_000;
const tokens = new Map<string, { valor: string; vence: number }>();
const configuraciones = new Map<string, { valor: Configuracion | null; vence: number }>();

export function olvidarConfiguracionCorreo() {
  configuraciones.clear();
  tokens.clear();
}

async function configuracion(cuentaId?: string): Promise<Configuracion | null> {
  const llave = cuentaId ?? "";
  const enCache = configuraciones.get(llave);
  if (enCache && enCache.vence > Date.now()) return enCache.valor;
  const valor = await leerConfiguracion(cuentaId);
  configuraciones.set(llave, { valor, vence: Date.now() + VIGENCIA_CONFIGURACION_MS });
  return valor;
}

async function leerConfiguracion(cuentaId?: string): Promise<Configuracion | null> {
  const ahora = new Date();
  const cuentas = await db.cuentaCorreo.findMany({
    where: cuentaId ? { id: cuentaId } : { activa: true },
    orderBy: [{ predeterminada: "desc" }, { createdAt: "asc" }],
    include: { claves: { where: { activa: true, OR: [{ vence: null }, { vence: { gt: ahora } }] }, orderBy: { createdAt: "desc" } } },
  });
  if (cuentas.length === 0) return cuentaId ? null : configuracionEntorno();
  for (const cuenta of cuentas) {
    const credenciales = cuenta.claves.flatMap((k) => {
      try {
        return [{ clave: k.id, tenantId: cuenta.tenantId, clientId: cuenta.clientId, clientSecret: descifrarSecreto(k.cifrado) }];
      } catch {
        return [];
      }
    });
    if (credenciales.length) return { cuentaId: cuenta.id, remitente: cuenta.remitente, credenciales };
  }
  return null;
}

export async function correoConfigurado(): Promise<boolean> {
  return (await configuracion().catch(() => null)) !== null;
}

export function variablesEntornoCorreo(): string | null {
  return configuracionEntorno()?.remitente ?? null;
}

function llaveToken(c: Credencial) {
  return `${c.tenantId}|${c.clientId}|${c.clave}`;
}

async function obtenerToken(c: Credencial): Promise<string> {
  const llave = llaveToken(c);
  const enCache = tokens.get(llave);
  if (enCache && enCache.vence > Date.now() + 60_000) return enCache.valor;
  const respuesta = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
    signal: AbortSignal.timeout(15000),
  });
  const cuerpo = (await respuesta.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!respuesta.ok || !cuerpo.access_token) {
    throw new Error(`Microsoft 365 no autorizó la aplicación: ${cuerpo.error_description?.split("\r\n")[0] ?? respuesta.status}`);
  }
  tokens.set(llave, { valor: cuerpo.access_token, vence: Date.now() + (cuerpo.expires_in ?? 3600) * 1000 });
  return cuerpo.access_token;
}

export type CorreoSaliente = { para: string[]; asunto: string; html: string; cc?: string[] };

function destinatarios(correos: string[] | undefined) {
  return [...new Set((correos ?? []).map((c) => c.trim().toLowerCase()).filter((c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)))].map((address) => ({ emailAddress: { address } }));
}

export type ResultadoEnvio = { ok: true } | { ok: false; mensaje: string };
export type EnvioPreparado = { remitente: string; enviar: (correo: CorreoSaliente) => Promise<ResultadoEnvio> };

const REINTENTOS_LIMITE = 2;
const ESPERA_MAXIMA_MS = 20_000;

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function esperaSolicitada(respuesta: Response, intento: number): number {
  const segundos = Number(respuesta.headers.get("retry-after"));
  return Math.min(Number.isFinite(segundos) && segundos > 0 ? segundos * 1000 : 2000 * (intento + 1), ESPERA_MAXIMA_MS);
}

export async function prepararEnvio(cuentaId?: string): Promise<EnvioPreparado | null> {
  const c = await configuracion(cuentaId).catch(() => null);
  if (!c) return null;
  const remitente = c.remitente;
  let indice = 0;

  async function token(): Promise<string | { error: string }> {
    let ultimo = "No se obtuvo autorización de Microsoft 365.";
    for (; indice < c!.credenciales.length; indice++) {
      try {
        return await obtenerToken(c!.credenciales[indice]!);
      } catch (err) {
        ultimo = err instanceof Error ? err.message : ultimo;
      }
    }
    return { error: ultimo };
  }

  async function enviar(correo: CorreoSaliente): Promise<ResultadoEnvio> {
    const para = destinatarios(correo.para);
    if (para.length === 0) return { ok: false, mensaje: "No hay destinatarios válidos." };
    const cuerpoMensaje = JSON.stringify({
      message: { subject: correo.asunto, body: { contentType: "HTML", content: correo.html }, toRecipients: para, ccRecipients: destinatarios(correo.cc) },
      saveToSentItems: true,
    });
    for (let intento = 0; ; intento++) {
      const t = await token();
      if (typeof t !== "string") return { ok: false, mensaje: t.error };
      let respuesta: Response;
      try {
        respuesta = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(remitente)}/sendMail`, {
          method: "POST",
          headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
          body: cuerpoMensaje,
          signal: AbortSignal.timeout(20000),
        });
      } catch (err) {
        if (intento < REINTENTOS_LIMITE) {
          await esperar(2000 * (intento + 1));
          continue;
        }
        return { ok: false, mensaje: err instanceof Error ? err.message : "No se pudo enviar el correo." };
      }
      if (respuesta.status === 202) return { ok: true };
      if (intento < REINTENTOS_LIMITE) {
        if (respuesta.status === 401) {
          tokens.delete(llaveToken(c!.credenciales[indice]!));
          indice++;
          continue;
        }
        if (respuesta.status === 429 || respuesta.status === 503 || respuesta.status === 504) {
          await esperar(esperaSolicitada(respuesta, intento));
          continue;
        }
      }
      const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
      return { ok: false, mensaje: `Microsoft 365 rechazó el envío (${respuesta.status}${cuerpo.error?.code ? ` · ${cuerpo.error.code}` : ""}): ${cuerpo.error?.message ?? "sin detalle"}` };
    }
  }

  return { remitente, enviar };
}

export async function enviarCorreo(correo: CorreoSaliente, cuentaId?: string): Promise<ResultadoEnvio> {
  const envio = await prepararEnvio(cuentaId);
  if (!envio) return { ok: false, mensaje: "El correo institucional no está configurado o no tiene claves vigentes." };
  return envio.enviar(correo);
}

export function plantillaCorreo(titulo: string, cuerpoHtml: string, enlace?: { texto: string; url: string }): string {
  const boton = enlace
    ? `<p style="margin:20px 0"><a href="${enlace.url}" style="background:#038F67;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">${enlace.texto}</a></p>`
    : "";
  return `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;color:#1c1917;max-width:600px">
<p style="font-size:12px;color:#038F67;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin:0 0 8px">CDMB · Plataforma de trámites</p>
<h2 style="font-size:18px;margin:0 0 12px">${titulo}</h2>
${cuerpoHtml}
${boton}
<p style="font-size:11px;color:#78716c;border-top:1px solid #e7e5e4;padding-top:10px;margin-top:24px">Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga — mensaje automático, por favor no responda a este correo.</p>
</div>`;
}
