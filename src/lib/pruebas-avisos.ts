import { randomUUID } from "crypto";
import type { Prisma, TipoNotificacion } from "@prisma/client";
import { db } from "@/lib/db";
import { prepararEnvio } from "@/lib/correo-microsoft";
import {
  CATEGORIAS_AVISO,
  definicionAviso,
  direccionesSuprimidas,
  ENCABEZADO_ENVIO,
  escaparHtml,
  MENSAJE_SIN_CONFIGURAR,
  MODULOS_AVISO,
  parametros,
  partirClave,
  renderizarMensaje,
  urlBasePlataforma,
  type ClaveMatriz,
  type EventoAviso,
  type Mensaje,
  type ModuloAviso,
} from "@/lib/avisos-correo";
import { Bandeja, contextoAlertas, FUENTES_ALERTAS, mensajeAlertas, type Alerta } from "@/lib/alertas-correo";
import { alertasAdministrador, mensajeAdministrador } from "@/lib/mantenimiento-correo";
import { mensajeDeNotificacion } from "@/lib/notificaciones";
import { mensajeRadicadoPqrsd, mensajeRadicadoTramite, mensajeRespuestaPqrsd } from "@/lib/avisos-externos";
import {
  BUZON_POR_MODULO,
  describirObjetivo,
  mensajeFirmaRechazada,
  mensajeFirmaRecordada,
  mensajeFirmaSolicitada,
  moduloDeObjetivo,
  objetivoDeSolicitud,
  rutaDeFirma,
} from "@/lib/solicitudes-firma";
import { ETIQUETA_MEDIO_DESPACHO, MEDIOS_DESPACHO, type MedioDespacho } from "@/lib/correspondencia";
import type { ModuloFirma } from "@/lib/jerarquia-firma";

type Muestra = { mensaje: Mensaje; referencia: string | null };

const INICIO_MODULO: Record<ModuloAviso, string> = {
  TRAMITES: "/expedientes",
  GECON: "/contratacion",
  SGDEA: "/correspondencia",
  PLATAFORMA: "/admin/correo",
};

const FIRMAS_DEL_MODULO: Record<ModuloFirma, Prisma.SolicitudFirmaWhereInput> = {
  TRAMITES: { documentoExpedienteId: { not: null } },
  GECON: { documentoContratoId: { not: null } },
  SGDEA: { OR: [{ comunicacionId: { not: null } }, { documentoArchivoId: { not: null } }] },
};

const DOCUMENTO_EJEMPLO: Record<ModuloFirma, { nombre: string; referencia: string }> = {
  TRAMITES: { nombre: "Auto de inicio de ejemplo", referencia: "Expediente de ejemplo" },
  GECON: { nombre: "Informe de supervisión de ejemplo", referencia: "Contrato de ejemplo" },
  SGDEA: { nombre: "Oficio de respuesta de ejemplo", referencia: "CDMB-E-2026-000000" },
};

function esModuloFirma(m: ModuloAviso): m is ModuloFirma {
  return m !== "PLATAFORMA";
}

async function muestraFirma(evento: EventoAviso, modulo: ModuloFirma, quien: string): Promise<Muestra> {
  const rechazada = evento === "FIRMA_RECHAZADA";
  const s =
    (rechazada
      ? await db.solicitudFirma.findFirst({ where: { ...FIRMAS_DEL_MODULO[modulo], rol: { not: "LECTURA" }, estado: "RECHAZADA" }, orderBy: { asignadoEn: "desc" }, select: SELECT_FIRMA })
      : null) ??
    (await db.solicitudFirma.findFirst({ where: { ...FIRMAS_DEL_MODULO[modulo], rol: { not: "LECTURA" } }, orderBy: { asignadoEn: "desc" }, select: SELECT_FIRMA }));
  const objetivo = s ? objetivoDeSolicitud(s) : null;
  const doc = objetivo
    ? await describirObjetivo(objetivo)
    : { ...DOCUMENTO_EJEMPLO[modulo], ruta: BUZON_POR_MODULO[modulo] };
  const ruta = s && objetivo ? rutaDeFirma(s.id, moduloDeObjetivo(objetivo.tipo), doc.ruta) : BUZON_POR_MODULO[modulo];
  const referencia = s ? doc.referencia : null;
  if (evento === "FIRMA_SOLICITADA") return { referencia, mensaje: mensajeFirmaSolicitada({ firma: s?.rol !== "VISTO_BUENO", asignador: s?.asignadoPor.nombre ?? quien, doc, ruta }) };
  if (evento === "FIRMA_RECORDADA") return { referencia, mensaje: mensajeFirmaRecordada({ quien, doc, ruta }) };
  const real = s?.estado === "RECHAZADA";
  return {
    referencia: real ? referencia : null,
    mensaje: mensajeFirmaRechazada({
      visto: s?.rol === "VISTO_BUENO",
      quien: real ? s.usuarioAsignado.nombre : quien,
      doc,
      motivo: (real && s.comentario) || "Revisar el número de radicado citado en el asunto.",
    }),
  };
}

const SELECT_FIRMA = {
  id: true,
  rol: true,
  estado: true,
  comentario: true,
  comunicacionId: true,
  documentoContratoId: true,
  documentoExpedienteId: true,
  documentoArchivoId: true,
  asignadoPor: { select: { nombre: true } },
  usuarioAsignado: { select: { nombre: true } },
} satisfies Prisma.SolicitudFirmaSelect;

const NOTIFICACION_EJEMPLO: Partial<Record<EventoAviso, { titulo: string; mensaje: string; enlace: string }>> = {
  VISITA_SIN_PROGRAMAR: {
    titulo: "Programar visita técnica · Expediente de ejemplo",
    mensaje: "El trámite Concesión de aguas superficiales llegó al paso 4 (visita técnica) y requiere visita técnica. Asigne el personal y programe la visita.",
    enlace: "/planeador",
  },
  VISITA_NO_REALIZADA: {
    titulo: "Reprogramar visita · Expediente de ejemplo",
    mensaje: "La última visita del trámite Concesión de aguas superficiales no se pudo realizar y está en el paso 4 (visita técnica). Debe reprogramarse.",
    enlace: "/planeador",
  },
  VISITA_PROGRAMADA: {
    titulo: "Visita técnica asignada · Expediente de ejemplo",
    mensaje: "Se le programó la visita técnica del trámite Concesión de aguas superficiales: lunes 3 de noviembre, 8:00 a. m. a 12:00 m., vereda de ejemplo.",
    enlace: "/planeador",
  },
  VISITA_REPROGRAMADA: {
    titulo: "Visita técnica reprogramada · Expediente de ejemplo",
    mensaje: "Se reprogramó su visita técnica del trámite Concesión de aguas superficiales: martes 4 de noviembre, 8:00 a. m. a 12:00 m., vereda de ejemplo.",
    enlace: "/planeador",
  },
  VISITA_CANCELADA: {
    titulo: "Visita técnica cancelada · Expediente de ejemplo",
    mensaje: "Se canceló su visita técnica del trámite Concesión de aguas superficiales: lunes 3 de noviembre, 8:00 a. m., vereda de ejemplo. Motivo: el solicitante pidió aplazarla.",
    enlace: "/planeador",
  },
  CONCEPTO_POR_ELABORAR: {
    titulo: "Elaborar concepto técnico · Expediente de ejemplo",
    mensaje: "El trámite Concesión de aguas superficiales llegó al paso 5 (concepto técnico). Le corresponde elaborar el concepto técnico.",
    enlace: "/planeador",
  },
  CONCEPTO_EN_REVISION: {
    titulo: "Concepto por revisar · Expediente de ejemplo",
    mensaje: "El profesional envió el concepto técnico a revisión. Apruébelo y envíelo a firma, o devuélvalo con observaciones.",
    enlace: "/planeador",
  },
  CONCEPTO_DEVUELTO: {
    titulo: "Concepto devuelto · Expediente de ejemplo",
    mensaje: "Quien revisa devolvió el concepto técnico: ajustar el caudal recomendado al aforo registrado en la visita.",
    enlace: "/planeador",
  },
  CONCEPTO_FIRMADO: {
    titulo: "Concepto 0001 firmado · Expediente de ejemplo",
    mensaje: "Todas las personas del equipo firmaron o dieron visto bueno al concepto técnico.",
    enlace: "/planeador",
  },
  CONCEPTO_RECHAZADO: {
    titulo: "Concepto 0001 rechazado · Expediente de ejemplo",
    mensaje: "Se rechazó la firma del concepto técnico: falta el registro fotográfico del punto de captación. Quien planea las visitas puede reabrirlo para corrección.",
    enlace: "/planeador",
  },
};

async function muestraNotificacion(evento: EventoAviso): Promise<Muestra> {
  const tipos: TipoNotificacion[] = evento === "VISITA_PROGRAMADA" ? ["VISITA_PROGRAMADA", "EQUIPO_VISITA"] : [evento as TipoNotificacion];
  const n = await db.notificacion.findFirst({ where: { tipo: { in: tipos } }, orderBy: { updatedAt: "desc" }, select: { titulo: true, mensaje: true, enlace: true } });
  if (n) return { referencia: n.titulo.split(" · ").pop() ?? n.titulo, mensaje: mensajeDeNotificacion(n) };
  return { referencia: null, mensaje: mensajeDeNotificacion(NOTIFICACION_EJEMPLO[evento]!) };
}

async function muestraExterna(evento: EventoAviso): Promise<Muestra> {
  if (evento === "PQRSD_RADICADO") {
    const c = await db.comunicacion.findFirst({
      where: { tipo: "RECIBIDA", tipoPqrsd: { not: null } },
      orderBy: { fechaRadicacion: "desc" },
      select: { radicado: true, asunto: true, tipoPqrsd: true, terceroNombre: true, fechaRadicacion: true, fechaVencimiento: true },
    });
    if (c?.tipoPqrsd) return { referencia: c.radicado, mensaje: mensajeRadicadoPqrsd({ ...c, tipoPqrsd: c.tipoPqrsd }) };
    return {
      referencia: null,
      mensaje: mensajeRadicadoPqrsd({
        radicado: "CDMB-R-2026-000000",
        asunto: "Solicitud de información sobre el estado de una concesión de aguas",
        tipoPqrsd: "PETICION_GENERAL",
        terceroNombre: "Ciudadano de ejemplo",
        fechaRadicacion: new Date(),
        fechaVencimiento: new Date(Date.now() + 15 * 86_400_000),
      }),
    };
  }
  if (evento === "PQRSD_RESPUESTA") {
    const c = await db.comunicacion.findFirst({
      where: { respondeA: { tipoPqrsd: { not: null } } },
      orderBy: [{ despachadaEn: { sort: "desc", nulls: "last" } }, { fechaRadicacion: "desc" }],
      select: { radicado: true, terceroNombre: true, despachoMedio: true, respondeA: { select: { radicado: true, asunto: true, terceroNombre: true } } },
    });
    if (c?.respondeA) {
      const medio = (MEDIOS_DESPACHO as readonly string[]).includes(c.despachoMedio ?? "") ? ETIQUETA_MEDIO_DESPACHO[c.despachoMedio as MedioDespacho] : ETIQUETA_MEDIO_DESPACHO.CORREO_ELECTRONICO;
      return {
        referencia: c.radicado,
        mensaje: mensajeRespuestaPqrsd({ oficioRadicado: c.radicado, solicitudRadicado: c.respondeA.radicado, asunto: c.respondeA.asunto, nombre: c.terceroNombre ?? c.respondeA.terceroNombre, medio }),
      };
    }
    return {
      referencia: null,
      mensaje: mensajeRespuestaPqrsd({
        oficioRadicado: "CDMB-E-2026-000000",
        solicitudRadicado: "CDMB-R-2026-000000",
        asunto: "Solicitud de información sobre el estado de una concesión de aguas",
        nombre: "Ciudadano de ejemplo",
        medio: ETIQUETA_MEDIO_DESPACHO.CORREO_ELECTRONICO,
      }),
    };
  }
  const e = await db.expediente.findFirst({ orderBy: { createdAt: "desc" }, select: { numero: true, solicitanteNombre: true, createdAt: true, tramiteTipo: { select: { nombre: true } } } });
  if (e) return { referencia: e.numero, mensaje: mensajeRadicadoTramite({ numero: e.numero, tramite: e.tramiteTipo.nombre, solicitante: e.solicitanteNombre, fecha: e.createdAt }) };
  return { referencia: null, mensaje: mensajeRadicadoTramite({ numero: "Expediente de ejemplo", tramite: "Concesión de aguas superficiales", solicitante: "Solicitante de ejemplo", fecha: new Date() }) };
}

const MAX_ALERTAS_MUESTRA = 8;

const ALERTA_EJEMPLO: Partial<Record<EventoAviso, Omit<Alerta, "evento" | "modulo" | "clave" | "ruta">>> = {
  PQRSD_POR_VENCER: { grupo: "PQRSD", texto: "CDMB-R-2026-000000 — vence el 5 nov · Solicitud de información de ejemplo", urgente: false },
  MEMORANDO_POR_VENCER: { grupo: "Memorandos por responder", texto: "CDMB-I-2026-000000 — plazo hasta el 4 nov · Memorando de ejemplo", urgente: false },
  FLUJO_POR_VENCER: { grupo: "Pasos de flujo", texto: "Objeto de ejemplo — «Revisión jurídica» (Flujo de ejemplo) vence el 4 nov", urgente: false },
  INFORME_ATRASADO: { grupo: "Informes de contratos sin radicar", texto: "Contrato de ejemplo — informe 3 (1 oct – 31 oct) con 1 día(s) de retraso", urgente: false },
  FIRMA_SIN_ATENDER: { grupo: "Firmas sin atender", texto: "Firmar: Documento de ejemplo — asignada hace 3 día(s)", urgente: false },
};

async function muestraAlertas(evento: EventoAviso, modulo: ModuloAviso, base: string | null): Promise<Muestra> {
  const fuente = FUENTES_ALERTAS[evento];
  const bandeja = new Bandeja((a) => a.evento === evento && a.modulo === modulo);
  if (fuente) await fuente(bandeja, await contextoAlertas());
  const alertas = [...new Map([...bandeja.porUsuario.values()].flat().map((a) => [a.clave, a])).values()]
    .sort((a, b) => Number(b.urgente) - Number(a.urgente))
    .slice(0, MAX_ALERTAS_MUESTRA);
  if (alertas.length) return { referencia: `${alertas.length} alerta(s) vigentes`, mensaje: mensajeAlertas(alertas, base) };
  const ejemplo = ALERTA_EJEMPLO[evento]!;
  const ruta = evento === "FIRMA_SIN_ATENDER" && esModuloFirma(modulo) ? BUZON_POR_MODULO[modulo] : INICIO_MODULO[modulo];
  return { referencia: null, mensaje: mensajeAlertas([{ ...ejemplo, evento, modulo, clave: "ejemplo", ruta }], base) };
}

async function muestraAdministrador(base: string | null): Promise<Muestra> {
  const alertas = await alertasAdministrador();
  if (alertas.length) return { referencia: `${alertas.length} novedad(es) vigentes`, mensaje: mensajeAdministrador(alertas.slice(0, MAX_ALERTAS_MUESTRA), base) };
  return {
    referencia: null,
    mensaje: mensajeAdministrador(
      [
        { evento: "ADMIN_CORREO", modulo: "PLATAFORMA", clave: "ejemplo-1", grupo: "Direcciones inexistentes", texto: "persona.inexistente@hotmail.com — 5.1.1; se dejó de enviar a esta dirección", ruta: "/admin/correo?tab=mantenimiento", urgente: true },
        { evento: "ADMIN_CORREO", modulo: "PLATAFORMA", clave: "ejemplo-2", grupo: "Cuentas de correo", texto: "La clave vigente de la cuenta de ejemplo vence en 30 día(s); registre una nueva antes de esa fecha", ruta: "/admin/correo?tab=cuentas", urgente: false },
      ],
      base
    ),
  };
}

export async function muestraAviso(clave: ClaveMatriz, quien: string, base: string | null): Promise<Muestra> {
  const { modulo, evento } = partirClave(clave);
  const def = definicionAviso(evento);
  if (evento === "ADMIN_CORREO") return muestraAdministrador(base);
  if (def.diario) return muestraAlertas(evento, modulo, base);
  if (def.categoria === "FIRMAS" && esModuloFirma(modulo)) return muestraFirma(evento, modulo, quien);
  if (def.categoria === "EXTERNOS") return muestraExterna(evento);
  return muestraNotificacion(evento);
}

function notaPrueba(clave: ClaveMatriz, referencia: string | null): string {
  const { modulo, evento } = partirClave(clave);
  const def = definicionAviso(evento);
  const origen = referencia ? `datos de ${escaparHtml(referencia)}` : "datos de ejemplo";
  return `<p style="margin:0 0 14px;padding:6px 10px;border-left:3px solid #FF8623;background:#fff7ed;font-size:12px;color:#7c2d12">Prueba · ${escaparHtml(MODULOS_AVISO[modulo])} · ${escaparHtml(CATEGORIAS_AVISO[def.categoria])}: ${escaparHtml(def.evento)} · ${origen}</p>`;
}

export type ResultadoPrueba = { ok: boolean; mensaje: string };

export async function enviarPruebaAviso(clave: ClaveMatriz, destino: string, solicitante: string, cuentaId?: string): Promise<ResultadoPrueba> {
  const { modulo, evento } = partirClave(clave);
  if ((await direccionesSuprimidas([destino])).has(destino)) return { ok: false, mensaje: `${destino} está en la lista de supresión por rebote.` };
  const base = urlBasePlataforma((await parametros()).urlPlataforma);
  const { mensaje, referencia } = await muestraAviso(clave, solicitante, base);
  const envio = await prepararEnvio(cuentaId);
  const lote = randomUUID();
  const fila = await db.correoEnviado.create({
    data: { clave: `prueba:${clave}:${Date.now()}`, destinatario: destino, categoria: evento, modulo, asunto: mensaje.asunto.slice(0, 300), envio: lote, intentos: 1, intentadoEn: new Date() },
    select: { id: true },
  });
  const r = envio
    ? await envio.enviar({ para: [destino], asunto: mensaje.asunto, html: renderizarMensaje(mensaje, base, notaPrueba(clave, referencia)), encabezados: { [ENCABEZADO_ENVIO]: lote } })
    : ({ ok: false, mensaje: MENSAJE_SIN_CONFIGURAR } as const);
  await db.correoEnviado.update({
    where: { id: fila.id },
    data: r.ok ? { estado: "ENVIADO", enviadoEn: new Date() } : { estado: "FALLIDO", error: r.mensaje.slice(0, 1000) },
  });
  return r.ok ? { ok: true, mensaje: `Enviada · ${referencia ? `datos de ${referencia}` : "datos de ejemplo"}` } : { ok: false, mensaje: r.mensaje };
}
