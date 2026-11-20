import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { direccionesSuprimidas, enSegundoPlano, escaparHtml } from "@/lib/avisos-correo";
import { enviarCorreo, plantillaCorreo } from "@/lib/correo-microsoft";
import {
  COOKIE_CIUDADANO,
  DURACION_SESION_CIUDADANO_S,
  LIMITE_CODIGOS_15MIN,
  LIMITE_CODIGOS_DIA,
  MAX_INTENTOS_CODIGO,
  VIGENCIA_CODIGO_MS,
  codigoCoincide,
  generarCodigo,
  generarTokenSesion,
  hashCodigo,
  hashTokenSesion,
} from "@/lib/cuenta-ciudadana";
import { normalizarIdentificacion } from "@/lib/solicitud-ambiental";

export type CuentaEnSesion = {
  id: string;
  correo: string;
  tipo: "NATURAL" | "JURIDICA";
  identificacion: string | null;
  nombre: string | null;
  telefono: string | null;
  /** Registro completo: ya dio su cédula o NIT, su nombre y aceptó el tratamiento de datos. */
  completa: boolean;
  /** Perfil de caracterización completo (dirección, régimen tributario, tipo de usuario…). */
  perfilCompleto: boolean;
};

/**
 * Pide un código de ingreso. Si el correo superó el límite, no se envía nada, pero la respuesta al
 * navegador es la misma (quien llama siempre responde igual): no se revela nada del correo.
 */
export async function solicitarCodigo(correo: string, ip: string | null): Promise<void> {
  const ahora = Date.now();
  const [en15, enDia] = await Promise.all([
    db.codigoAccesoCiudadano.count({ where: { correo, createdAt: { gte: new Date(ahora - 15 * 60_000) } } }),
    db.codigoAccesoCiudadano.count({ where: { correo, createdAt: { gte: new Date(ahora - 86_400_000) } } }),
  ]);
  if (en15 >= LIMITE_CODIGOS_15MIN || enDia >= LIMITE_CODIGOS_DIA) return;

  const cuenta = await db.cuentaCiudadana.findUnique({ where: { correo }, select: { bloqueada: true } });
  if (cuenta?.bloqueada) return;

  const codigo = generarCodigo();
  await db.$transaction([
    // Un código nuevo anula los anteriores sin usar.
    db.codigoAccesoCiudadano.updateMany({ where: { correo, proposito: "INGRESO", usadoEn: null, expiraEn: { gt: new Date(ahora) } }, data: { expiraEn: new Date(ahora) } }),
    db.codigoAccesoCiudadano.create({ data: { correo, proposito: "INGRESO", codigoHash: hashCodigo(correo, codigo), expiraEn: new Date(ahora + VIGENCIA_CODIGO_MS), ip } }),
  ]);
  enSegundoPlano(() => enviarCodigo(correo, codigo));
}

async function enviarCodigo(correo: string, codigo: string) {
  if ((await direccionesSuprimidas([correo])).has(correo)) return;
  const cuerpo = `
    <p>Para ingresar a <strong>Mis solicitudes</strong> de la CDMB escriba este código:</p>
    <p style="font-size:28px;font-weight:bold;letter-spacing:6px;font-family:monospace;margin:16px 0">${escaparHtml(codigo)}</p>
    <p>Vence en 10 minutos y sirve una sola vez. Ningún funcionario de la CDMB se lo pedirá: no lo comparta.</p>
    <p style="color:#78716c;font-size:12px">Si usted no pidió este código, ignore este mensaje; nadie podrá entrar sin él.</p>`;
  // No se guarda en la bitácora de correos: el mensaje contiene el código.
  const r = await enviarCorreo({ para: [correo], asunto: `Su código de ingreso: ${codigo} — CDMB`, html: plantillaCorreo("Código de ingreso", cuerpo) });
  if (!r.ok) console.error("No se pudo enviar el código de ingreso ciudadano:", r.mensaje);
}

/**
 * Comprueba el código. Cada intento cuenta (máximo 5 por código), el código sirve una sola vez y, si
 * es correcto, se crea la cuenta (si no existía) y se abre la sesión.
 */
export async function verificarCodigo(correo: string, codigo: string, meta: { ip: string | null; userAgent: string | null }): Promise<boolean> {
  const ahora = new Date();
  const fila = await db.codigoAccesoCiudadano.findFirst({
    where: { correo, proposito: "INGRESO", usadoEn: null, expiraEn: { gt: ahora } },
    orderBy: { createdAt: "desc" },
    select: { id: true, codigoHash: true },
  });
  if (!fila) return false;
  const contado = await db.codigoAccesoCiudadano.updateMany({
    where: { id: fila.id, usadoEn: null, intentos: { lt: MAX_INTENTOS_CODIGO } },
    data: { intentos: { increment: 1 } },
  });
  if (contado.count !== 1 || !codigoCoincide(correo, codigo, fila.codigoHash)) return false;
  const usado = await db.codigoAccesoCiudadano.updateMany({ where: { id: fila.id, usadoEn: null }, data: { usadoEn: ahora } });
  if (usado.count !== 1) return false;

  const cuenta = await db.cuentaCiudadana.upsert({
    where: { correo },
    create: { correo, ultimoIngreso: ahora },
    update: { ultimoIngreso: ahora },
    select: { id: true, bloqueada: true },
  });
  if (cuenta.bloqueada) return false;

  const token = generarTokenSesion();
  await db.sesionCiudadana.create({
    data: {
      cuentaId: cuenta.id,
      tokenHash: hashTokenSesion(token),
      expiraEn: new Date(ahora.getTime() + DURACION_SESION_CIUDADANO_S * 1000),
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    },
  });
  const almacen = await cookies();
  almacen.set(COOKIE_CIUDADANO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SESION_CIUDADANO_S,
  });
  await vincularAutomaticamente(cuenta.id);
  return true;
}

export async function cuentaEnSesion(): Promise<CuentaEnSesion | null> {
  const token = (await cookies()).get(COOKIE_CIUDADANO)?.value;
  if (!token || token.length > 100) return null;
  const sesion = await db.sesionCiudadana.findUnique({
    where: { tokenHash: hashTokenSesion(token) },
    select: {
      expiraEn: true,
      revocadaEn: true,
      cuenta: {
        select: {
          id: true,
          correo: true,
          tipo: true,
          identificacion: true,
          nombre: true,
          telefono: true,
          celular: true,
          direccion: true,
          regimenTributario: true,
          tipoUsuario: true,
          aceptaTratamientoEn: true,
          bloqueada: true,
        },
      },
    },
  });
  if (!sesion || sesion.revocadaEn || sesion.expiraEn <= new Date() || sesion.cuenta.bloqueada) return null;
  const c = sesion.cuenta;
  return {
    id: c.id,
    correo: c.correo,
    tipo: c.tipo,
    identificacion: c.identificacion,
    nombre: c.nombre,
    telefono: c.telefono ?? c.celular,
    completa: Boolean(c.identificacion && c.nombre && c.aceptaTratamientoEn),
    perfilCompleto: Boolean(c.identificacion && c.nombre && c.aceptaTratamientoEn && c.direccion && c.regimenTributario && c.tipoUsuario),
  };
}

export async function cerrarSesionCiudadana(): Promise<void> {
  const almacen = await cookies();
  const token = almacen.get(COOKIE_CIUDADANO)?.value;
  if (token && token.length <= 100) {
    await db.sesionCiudadana.updateMany({ where: { tokenHash: hashTokenSesion(token), revocadaEn: null }, data: { revocadaEn: new Date() } });
  }
  almacen.delete(COOKIE_CIUDADANO);
}

/**
 * Vincula sola las solicitudes radicadas en línea que tienen a la vez el correo verificado de la
 * cuenta y su cédula o NIT. Las demás se vinculan a mano con el número de solicitud.
 */
export async function vincularAutomaticamente(cuentaId: string): Promise<number> {
  const cuenta = await db.cuentaCiudadana.findUnique({ where: { id: cuentaId }, select: { correo: true, identificacion: true } });
  if (!cuenta?.identificacion) return 0;
  const candidatos = await db.expediente.findMany({
    where: { cuentaCiudadanaId: null, codigoSolicitudPublica: { not: null }, solicitanteEmail: { equals: cuenta.correo, mode: "insensitive" } },
    select: { id: true, solicitanteIdentificacion: true },
    take: 200,
  });
  const ids = candidatos.filter((e) => normalizarIdentificacion(e.solicitanteIdentificacion) === cuenta.identificacion).map((e) => e.id);
  if (ids.length === 0) return 0;
  const r = await db.expediente.updateMany({ where: { id: { in: ids }, cuentaCiudadanaId: null }, data: { cuentaCiudadanaId: cuentaId } });
  return r.count;
}

/**
 * Cambio de correo: código al correo NUEVO (propósito CAMBIO_CORREO, atado a la cuenta). La
 * respuesta al navegador es siempre la misma, esté o no ocupado el correo nuevo.
 */
export async function solicitarCambioCorreo(cuentaId: string, correoNuevo: string, ip: string | null): Promise<void> {
  const ahora = Date.now();
  const [en15, enDia, ocupado] = await Promise.all([
    db.codigoAccesoCiudadano.count({ where: { cuentaId, proposito: "CAMBIO_CORREO", createdAt: { gte: new Date(ahora - 15 * 60_000) } } }),
    db.codigoAccesoCiudadano.count({ where: { cuentaId, proposito: "CAMBIO_CORREO", createdAt: { gte: new Date(ahora - 86_400_000) } } }),
    db.cuentaCiudadana.count({ where: { correo: correoNuevo } }),
  ]);
  if (en15 >= LIMITE_CODIGOS_15MIN || enDia >= LIMITE_CODIGOS_DIA || ocupado > 0) return;
  const codigo = generarCodigo();
  await db.$transaction([
    db.codigoAccesoCiudadano.updateMany({ where: { cuentaId, proposito: "CAMBIO_CORREO", usadoEn: null, expiraEn: { gt: new Date(ahora) } }, data: { expiraEn: new Date(ahora) } }),
    db.codigoAccesoCiudadano.create({
      data: { correo: correoNuevo, cuentaId, proposito: "CAMBIO_CORREO", codigoHash: hashCodigo(correoNuevo, codigo), expiraEn: new Date(ahora + VIGENCIA_CODIGO_MS), ip },
    }),
  ]);
  enSegundoPlano(async () => {
    if ((await direccionesSuprimidas([correoNuevo])).has(correoNuevo)) return;
    const cuerpo = `
      <p>Para confirmar este correo como el nuevo de su cuenta en <strong>Mis solicitudes</strong> de la CDMB, escriba este código:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:6px;font-family:monospace;margin:16px 0">${escaparHtml(codigo)}</p>
      <p>Vence en 10 minutos. Si usted no pidió este cambio, ignore este mensaje.</p>`;
    const r = await enviarCorreo({ para: [correoNuevo], asunto: `Confirme su nuevo correo: ${codigo} — CDMB`, html: plantillaCorreo("Confirmar correo nuevo", cuerpo) });
    if (!r.ok) console.error("No se pudo enviar el código de cambio de correo:", r.mensaje);
  });
}

/** Confirma el código del correo nuevo y lo deja como correo de la cuenta. Avisa al correo anterior. */
export async function confirmarCambioCorreo(cuentaId: string, codigo: string): Promise<{ ok: true; anterior: string; nuevo: string } | { ok: false }> {
  const ahora = new Date();
  const fila = await db.codigoAccesoCiudadano.findFirst({
    where: { cuentaId, proposito: "CAMBIO_CORREO", usadoEn: null, expiraEn: { gt: ahora } },
    orderBy: { createdAt: "desc" },
    select: { id: true, correo: true, codigoHash: true },
  });
  if (!fila) return { ok: false };
  const contado = await db.codigoAccesoCiudadano.updateMany({
    where: { id: fila.id, usadoEn: null, intentos: { lt: MAX_INTENTOS_CODIGO } },
    data: { intentos: { increment: 1 } },
  });
  if (contado.count !== 1 || !codigoCoincide(fila.correo, codigo, fila.codigoHash)) return { ok: false };
  const usado = await db.codigoAccesoCiudadano.updateMany({ where: { id: fila.id, usadoEn: null }, data: { usadoEn: ahora } });
  if (usado.count !== 1) return { ok: false };
  const antes = await db.cuentaCiudadana.findUnique({ where: { id: cuentaId }, select: { correo: true } });
  if (!antes) return { ok: false };
  try {
    await db.cuentaCiudadana.update({ where: { id: cuentaId }, data: { correo: fila.correo } });
  } catch {
    return { ok: false }; // el correo nuevo lo tomó otra cuenta mientras tanto
  }
  enSegundoPlano(async () => {
    const cuerpo = `<p>El correo de su cuenta en <strong>Mis solicitudes</strong> de la CDMB se cambió por otro. Desde ahora los códigos de ingreso llegarán al correo nuevo.</p>
      <p>Si usted no hizo este cambio, comuníquese de inmediato con la CDMB.</p>`;
    const r = await enviarCorreo({ para: [antes.correo], asunto: "Se cambió el correo de su cuenta — CDMB", html: plantillaCorreo("Cambio de correo", cuerpo) });
    if (!r.ok) console.error("No se pudo avisar el cambio de correo:", r.mensaje);
  });
  return { ok: true, anterior: antes.correo, nuevo: fila.correo };
}

/** Campos del perfil que se muestran y editan en «Mi perfil» y con los que se precarga la radicación. */
export const SELECT_PERFIL = {
  correo: true,
  tipo: true,
  tipoIdentificacion: true,
  identificacion: true,
  nombres: true,
  apellidos: true,
  razonSocial: true,
  nombre: true,
  correoAlterno: true,
  celular: true,
  telefono: true,
  direccion: true,
  departamento: true,
  ciudad: true,
  regimenTributario: true,
  granContribuyente: true,
  representanteLegal: true,
  representanteIdentificacion: true,
  tipoUsuario: true,
  autorizaNotificacionElectronica: true,
  aceptaTratamientoEn: true,
  perfilActualizadoEn: true,
} as const;

export async function perfilDeCuenta(cuentaId: string) {
  return db.cuentaCiudadana.findUnique({ where: { id: cuentaId }, select: SELECT_PERFIL });
}
