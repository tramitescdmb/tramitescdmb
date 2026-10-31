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

async function configuracion(cuentaId?: string): Promise<Configuracion | null> {
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
  return (await configuracion()) !== null;
}

export function variablesEntornoCorreo(): string | null {
  return configuracionEntorno()?.remitente ?? null;
}

const tokens = new Map<string, { valor: string; vence: number }>();

async function obtenerToken(c: Credencial): Promise<string> {
  const llave = `${c.tenantId}|${c.clientId}|${c.clave}`;
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

export async function enviarCorreo(correo: CorreoSaliente, cuentaId?: string): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const c = await configuracion(cuentaId).catch(() => null);
  if (!c) return { ok: false, mensaje: "El correo institucional no está configurado o no tiene claves vigentes." };
  const para = destinatarios(correo.para);
  if (para.length === 0) return { ok: false, mensaje: "No hay destinatarios válidos." };
  let token: string | null = null;
  let errorToken = "";
  for (const credencial of c.credenciales) {
    try {
      token = await obtenerToken(credencial);
      break;
    } catch (err) {
      errorToken = err instanceof Error ? err.message : "No se obtuvo autorización de Microsoft 365.";
    }
  }
  if (!token) return { ok: false, mensaje: errorToken };
  try {
    const respuesta = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(c.remitente)}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: { subject: correo.asunto, body: { contentType: "HTML", content: correo.html }, toRecipients: para, ccRecipients: destinatarios(correo.cc) },
        saveToSentItems: true,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (respuesta.status === 202) return { ok: true };
    const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    return { ok: false, mensaje: `Microsoft 365 rechazó el envío (${respuesta.status}${cuerpo.error?.code ? ` · ${cuerpo.error.code}` : ""}): ${cuerpo.error?.message ?? "sin detalle"}` };
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : "No se pudo enviar el correo." };
  }
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
