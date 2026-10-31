import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { prepararEnvio } from "@/lib/correo-microsoft";
import {
  correoDeUsuario,
  direccionesSuprimidas,
  ENCABEZADO_ENVIO,
  MOTIVO_SUPRIMIDA,
  parametros,
  pausa,
  procesarColaCorreo,
  renderizarMensaje,
  urlBasePlataforma,
  type Mensaje,
  type ResultadoCola,
} from "@/lib/avisos-correo";
import { cuerpoAlertas, registrarLote, type Alerta } from "@/lib/alertas-correo";
import { procesarRebotes, type ResultadoRebotes } from "@/lib/rebotes-correo";

const DIA = 86_400_000;
export const RETENCION_REGISTRO_DIAS = 365;
export const RETENCION_CUERPO_DIAS = 30;
const UMBRALES_CLAVE_DIAS = [30, 7, 1];
const VENTANA_ADMIN_DIAS = 7;
const MAX_ITEMS_ADMIN = 25;
const RUTA_CORREO = "/admin/correo";

function fecha(d: Date) {
  return d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" });
}

export type ResultadoLimpieza = { registrosBorrados: number; cuerposDepurados: number };

export async function depurarRegistroCorreo(): Promise<ResultadoLimpieza> {
  const ahora = Date.now();
  const borrados = await db.correoEnviado.deleteMany({ where: { createdAt: { lt: new Date(ahora - RETENCION_REGISTRO_DIAS * DIA) } } });
  const depurados = await db.correoEnviado.updateMany({
    where: {
      html: { not: null },
      OR: [{ estado: { in: ["ENVIADO", "REBOTADO", "OMITIDO"] } }, { estado: "FALLIDO", createdAt: { lt: new Date(ahora - RETENCION_CUERPO_DIAS * DIA) } }],
    },
    data: { html: null },
  });
  return { registrosBorrados: borrados.count, cuerposDepurados: depurados.count };
}

export async function alertasAdministrador(): Promise<Alerta[]> {
  const ahora = Date.now();
  const desde = new Date(ahora - VENTANA_ADMIN_DIAS * DIA);
  const [suprimidas, fallidos, cuentas] = await Promise.all([
    db.correoSuprimido.findMany({ where: { ultimoEn: { gte: desde } }, orderBy: { ultimoEn: "desc" }, take: MAX_ITEMS_ADMIN }),
    db.correoEnviado.findMany({
      where: { estado: "FALLIDO", createdAt: { gte: desde }, categoria: { not: "ADMIN_CORREO" }, NOT: { clave: { startsWith: "prueba:" } } },
      orderBy: { createdAt: "desc" },
      take: MAX_ITEMS_ADMIN,
      select: { id: true, destinatario: true, asunto: true, error: true },
    }),
    db.cuentaCorreo.findMany({ where: { activa: true }, include: { claves: { where: { activa: true } } } }),
  ]);
  const usuarios = suprimidas.length
    ? await db.usuario.findMany({
        where: { OR: [{ correoNotificacion: { in: suprimidas.map((s) => s.correo) } }, { email: { in: suprimidas.map((s) => s.correo) } }] },
        select: { nombre: true, email: true, correoNotificacion: true },
      })
    : [];
  const base = { evento: "ADMIN_CORREO" as const, modulo: "PLATAFORMA" as const };
  const alertas: Alerta[] = [];

  for (const c of cuentas) {
    const vigentes = c.claves.filter((k) => !k.vence || k.vence.getTime() > ahora);
    if (vigentes.length === 0) {
      const ultima = c.claves.map((k) => k.vence?.getTime() ?? 0).sort((a, b) => b - a)[0] ?? 0;
      alertas.push({ ...base, clave: `admin-cuenta-sin-claves:${c.id}:${ultima}`, grupo: "Cuentas de correo", texto: `«${c.nombre}» (${c.remitente}) no tiene claves vigentes`, ruta: `${RUTA_CORREO}?tab=cuentas`, urgente: true });
      continue;
    }
    const masLejana = Math.max(...vigentes.map((k) => k.vence?.getTime() ?? Number.POSITIVE_INFINITY));
    if (!Number.isFinite(masLejana)) continue;
    const dias = Math.ceil((masLejana - ahora) / DIA);
    const umbral = [...UMBRALES_CLAVE_DIAS].sort((a, b) => a - b).find((u) => dias <= u);
    if (umbral === undefined) continue;
    alertas.push({
      ...base,
      clave: `admin-clave-por-vencer:${c.id}:${masLejana}:${umbral}`,
      grupo: "Cuentas de correo",
      texto: `La clave vigente de «${c.nombre}» vence el ${fecha(new Date(masLejana))} (${dias} día(s)); registre una nueva antes de esa fecha`,
      ruta: `${RUTA_CORREO}?tab=cuentas`,
      urgente: umbral <= 7,
    });
  }
  for (const c of cuentas) {
    if (c.rebotesRevisionOk === false && c.rebotesMensaje?.includes("Mail.ReadWrite")) {
      alertas.push({ ...base, clave: `admin-permiso-rebotes:${c.id}`, grupo: "Cuentas de correo", texto: `«${c.nombre}»: falta el permiso Mail.ReadWrite para leer los rebotes del buzón`, ruta: `${RUTA_CORREO}?tab=mantenimiento`, urgente: false });
    }
  }
  for (const s of suprimidas) {
    const quien = usuarios.find((u) => correoDeUsuario(u) === s.correo);
    alertas.push({
      ...base,
      clave: `admin-suprimida:${s.correo}:${s.rebotes}`,
      grupo: "Direcciones inexistentes",
      texto: `${s.correo}${quien ? ` (${quien.nombre})` : ""} — ${s.codigo ?? "rebote"}; se dejó de enviar a esta dirección`,
      ruta: `${RUTA_CORREO}?tab=mantenimiento`,
      urgente: Boolean(quien),
    });
  }
  for (const f of fallidos) {
    alertas.push({
      ...base,
      clave: `admin-fallido:${f.id}`,
      grupo: "Envíos descartados",
      texto: `«${f.asunto}» para ${f.destinatario}: ${(f.error ?? "sin detalle").slice(0, 160)}`,
      ruta: `${RUTA_CORREO}?tab=envios&estado=FALLIDO`,
      urgente: false,
    });
  }
  return alertas;
}

export function mensajeAdministrador(alertas: Alerta[], base: string | null): Mensaje {
  return {
    asunto: `Correo institucional: ${alertas.length} novedad(es) · Plataforma CDMB`,
    titulo: "Novedades del correo institucional",
    cuerpoHtml: cuerpoAlertas(alertas, base),
    enlace: { texto: "Abrir el correo institucional", ruta: RUTA_CORREO },
  };
}

export type ResultadoAdministrador = { alertas: number; correos: number; fallidos: number; motivo?: string };

async function avisarAdministradores(): Promise<ResultadoAdministrador> {
  const { activos, urlPlataforma } = await parametros();
  if (!activos.has("PLATAFORMA.ADMIN_CORREO")) return { alertas: 0, correos: 0, fallidos: 0, motivo: "Aviso al administrador desactivado en la matriz." };
  const alertas = await alertasAdministrador();
  if (alertas.length === 0) return { alertas: 0, correos: 0, fallidos: 0 };
  const admins = await db.usuario.findMany({ where: { activo: true, rol: "ADMIN" }, select: { email: true, correoNotificacion: true } });
  const correos = [...new Set(admins.map(correoDeUsuario).filter((c): c is string => Boolean(c)))];
  const [envio, suprimidas, enviadas] = await Promise.all([
    prepararEnvio(),
    direccionesSuprimidas(correos),
    db.correoEnviado.findMany({ where: { estado: "ENVIADO", clave: { in: alertas.map((a) => a.clave) } }, select: { clave: true, destinatario: true } }),
  ]);
  const ya = new Set(enviadas.map((e) => `${e.clave}|${e.destinatario}`));
  const r: ResultadoAdministrador = { alertas: alertas.length, correos: 0, fallidos: 0 };
  if (!envio) return { ...r, motivo: "Correo sin configurar." };
  const base = urlBasePlataforma(urlPlataforma);
  for (const correo of correos) {
    const nuevas = alertas.filter((a) => !ya.has(`${a.clave}|${correo}`));
    if (nuevas.length === 0) continue;
    try {
      const mensaje = mensajeAdministrador(nuevas, base);
      if (suprimidas.has(correo)) {
        await registrarLote(correo, nuevas, mensaje.asunto, { estado: "OMITIDO", error: MOTIVO_SUPRIMIDA });
        continue;
      }
      if (r.correos + r.fallidos > 0) await pausa();
      const lote = randomUUID();
      const resultado = await envio.enviar({ para: [correo], asunto: mensaje.asunto, html: renderizarMensaje(mensaje, base), encabezados: { [ENCABEZADO_ENVIO]: lote } });
      await registrarLote(correo, nuevas, mensaje.asunto, { estado: resultado.ok ? "ENVIADO" : "FALLIDO", error: resultado.ok ? null : resultado.mensaje, envio: lote });
      if (resultado.ok) r.correos++;
      else r.fallidos++;
    } catch (err) {
      r.fallidos++;
      console.error(`Aviso al administrador ${correo} no procesado:`, err);
    }
  }
  return r;
}

export type ResultadoMantenimiento = {
  ok: boolean;
  cola: ResultadoCola | { error: string };
  rebotes: ResultadoRebotes[] | { error: string };
  limpieza: ResultadoLimpieza | { error: string };
  administrador: ResultadoAdministrador | { error: string };
};

async function paso<T>(tarea: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await tarea();
  } catch (err) {
    console.error("Mantenimiento del correo:", err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function ejecutarMantenimientoCorreo(): Promise<ResultadoMantenimiento> {
  const rebotes = await paso(procesarRebotes);
  const cola = await paso(() => procesarColaCorreo({ limite: 60, presupuestoMs: 150_000 }));
  const limpieza = await paso(depurarRegistroCorreo);
  const administrador = await paso(avisarAdministradores);
  const conError = [cola, limpieza, administrador].some((x) => "error" in x) || "error" in rebotes;
  return { ok: !conError, cola, rebotes, limpieza, administrador };
}
