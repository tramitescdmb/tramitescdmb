import { randomUUID } from "crypto";
import { after } from "next/server";
import type { EstadoCorreo } from "@prisma/client";
import { db } from "@/lib/db";
import { correoConfigurado, plantillaCorreo, prepararEnvio, type ResultadoEnvio } from "@/lib/correo-microsoft";

export type ModuloAviso = "TRAMITES" | "GECON" | "SGDEA" | "PLATAFORMA";

export const MODULOS_AVISO: Record<ModuloAviso, string> = {
  TRAMITES: "Trámites ambientales",
  GECON: "GECON",
  SGDEA: "SGDEA",
  PLATAFORMA: "Administración de la plataforma",
};

export type CategoriaAviso = "FIRMAS" | "VISITAS" | "CONCEPTOS" | "VENCIMIENTOS" | "EXTERNOS" | "ADMINISTRACION";

export const CATEGORIAS_AVISO: Record<CategoriaAviso, string> = {
  FIRMAS: "Firmas y vistos buenos",
  VISITAS: "Visitas técnicas",
  CONCEPTOS: "Conceptos técnicos",
  VENCIMIENTOS: "Alertas de vencimiento",
  EXTERNOS: "Ciudadanos y solicitantes",
  ADMINISTRACION: "Correo institucional",
};

export const HORA_ALERTAS = "7:30 a. m.";
export const HORA_MANTENIMIENTO = "7:00 a. m.";

type DefinicionAviso = {
  categoria: CategoriaAviso;
  modulos: readonly ModuloAviso[];
  evento: string;
  destinatarios: string;
  plataforma: string;
  diario?: string;
};

const MODULOS_FIRMA = ["TRAMITES", "GECON", "SGDEA"] as const;

export const EVENTOS_AVISO = {
  FIRMA_SOLICITADA: {
    categoria: "FIRMAS",
    modulos: MODULOS_FIRMA,
    evento: "Se solicita firmar o dar visto bueno a un documento",
    destinatarios: "Persona asignada",
    plataforma: "Buzón de firmas",
  },
  FIRMA_RECORDADA: {
    categoria: "FIRMAS",
    modulos: MODULOS_FIRMA,
    evento: "Un firmante posterior recuerda una firma pendiente",
    destinatarios: "Firmante con turno anterior",
    plataforma: "Buzón de firmas · campana",
  },
  FIRMA_RECHAZADA: {
    categoria: "FIRMAS",
    modulos: MODULOS_FIRMA,
    evento: "Se rechaza una firma o un visto bueno",
    destinatarios: "Quien cargó o proyectó el documento",
    plataforma: "Avisos de rechazo",
  },
  VISITA_SIN_PROGRAMAR: {
    categoria: "VISITAS",
    modulos: ["TRAMITES"],
    evento: "Un expediente llega a un paso que requiere visita técnica",
    destinatarios: "Planificadores del trámite",
    plataforma: "Campana",
  },
  VISITA_NO_REALIZADA: {
    categoria: "VISITAS",
    modulos: ["TRAMITES"],
    evento: "Una visita no se realizó y debe reprogramarse",
    destinatarios: "Planificadores del trámite",
    plataforma: "Campana",
  },
  VISITA_PROGRAMADA: {
    categoria: "VISITAS",
    modulos: ["TRAMITES"],
    evento: "Se programa una visita o se agrega a alguien al equipo",
    destinatarios: "Profesional y equipo de la visita",
    plataforma: "Campana · calendario",
  },
  VISITA_REPROGRAMADA: {
    categoria: "VISITAS",
    modulos: ["TRAMITES"],
    evento: "Se cambia la fecha, hora o lugar de una visita",
    destinatarios: "Profesional y equipo de la visita",
    plataforma: "Campana · calendario",
  },
  VISITA_CANCELADA: {
    categoria: "VISITAS",
    modulos: ["TRAMITES"],
    evento: "Se cancela una visita",
    destinatarios: "Profesional y equipo de la visita",
    plataforma: "Campana · calendario",
  },
  CONCEPTO_POR_ELABORAR: {
    categoria: "CONCEPTOS",
    modulos: ["TRAMITES"],
    evento: "El expediente llega al paso de concepto técnico",
    destinatarios: "Personal asignado al expediente",
    plataforma: "Campana",
  },
  CONCEPTO_EN_REVISION: {
    categoria: "CONCEPTOS",
    modulos: ["TRAMITES"],
    evento: "Un concepto se envía a revisión",
    destinatarios: "Planificadores del trámite",
    plataforma: "Campana",
  },
  CONCEPTO_DEVUELTO: {
    categoria: "CONCEPTOS",
    modulos: ["TRAMITES"],
    evento: "Un concepto se devuelve o se reabre para corrección",
    destinatarios: "Quienes elaboran el concepto",
    plataforma: "Campana",
  },
  CONCEPTO_FIRMADO: {
    categoria: "CONCEPTOS",
    modulos: ["TRAMITES"],
    evento: "Todo el equipo firmó el concepto",
    destinatarios: "Profesional, equipo y quien finalizó",
    plataforma: "Campana",
  },
  CONCEPTO_RECHAZADO: {
    categoria: "CONCEPTOS",
    modulos: ["TRAMITES"],
    evento: "Se rechaza la firma de un concepto",
    destinatarios: "Profesional, equipo y quien finalizó",
    plataforma: "Campana",
  },
  PQRSD_POR_VENCER: {
    categoria: "VENCIMIENTOS",
    modulos: ["SGDEA"],
    evento: "PQRSD a 3 días hábiles o menos de vencer, o vencida",
    destinatarios: "Funcionario asignado; si no hay, quienes reparten",
    plataforma: "Mi trabajo · inicio",
    diario: HORA_ALERTAS,
  },
  MEMORANDO_POR_VENCER: {
    categoria: "VENCIMIENTOS",
    modulos: ["SGDEA"],
    evento: "Memorando a 1 día hábil o menos de su plazo, o vencido",
    destinatarios: "Destinatarios del memorando",
    plataforma: "Memorandos · inicio",
    diario: HORA_ALERTAS,
  },
  FLUJO_POR_VENCER: {
    categoria: "VENCIMIENTOS",
    modulos: MODULOS_FIRMA,
    evento: "Paso de flujo a 1 día hábil o menos de su término, o vencido",
    destinatarios: "Responsable personal del paso (no dependencias ni cargos)",
    plataforma: "Tareas del flujo",
    diario: HORA_ALERTAS,
  },
  INFORME_ATRASADO: {
    categoria: "VENCIMIENTOS",
    modulos: ["GECON"],
    evento: "Informe o evidencias del período sin radicar (al día 1 y al día 10 de retraso)",
    destinatarios: "Contratista y supervisores",
    plataforma: "Panel GECON · inicio",
    diario: HORA_ALERTAS,
  },
  FIRMA_SIN_ATENDER: {
    categoria: "VENCIMIENTOS",
    modulos: MODULOS_FIRMA,
    evento: "Firma o visto bueno sin atender a los 3 y a los 10 días, cuando ya es su turno",
    destinatarios: "Persona asignada",
    plataforma: "Buzón de firmas",
    diario: HORA_ALERTAS,
  },
  PQRSD_RADICADO: {
    categoria: "EXTERNOS",
    modulos: ["SGDEA"],
    evento: "Se radica una PQRSD (web o ventanilla)",
    destinatarios: "Ciudadano, si dejó correo",
    plataforma: "—",
  },
  PQRSD_RESPUESTA: {
    categoria: "EXTERNOS",
    modulos: ["SGDEA"],
    evento: "Se despacha el oficio que responde una PQRSD",
    destinatarios: "Ciudadano, si dejó correo",
    plataforma: "—",
  },
  TRAMITE_RADICADO: {
    categoria: "EXTERNOS",
    modulos: ["TRAMITES"],
    evento: "Se radica un expediente de trámite",
    destinatarios: "Solicitante, si tiene correo",
    plataforma: "—",
  },
  ADMIN_CORREO: {
    categoria: "ADMINISTRACION",
    modulos: ["PLATAFORMA"],
    evento: "Direcciones inexistentes, envíos descartados y claves del correo por vencer",
    destinatarios: "Administradores del sistema",
    plataforma: "Correo institucional",
    diario: HORA_MANTENIMIENTO,
  },
} satisfies Record<string, DefinicionAviso>;

export type EventoAviso = keyof typeof EVENTOS_AVISO;

export function esEventoAviso(valor: string): valor is EventoAviso {
  return valor in EVENTOS_AVISO;
}

export function definicionAviso(evento: EventoAviso): DefinicionAviso {
  return EVENTOS_AVISO[evento];
}

export type ClaveMatriz = `${ModuloAviso}.${EventoAviso}`;

export function claveMatriz(modulo: ModuloAviso, evento: EventoAviso): ClaveMatriz {
  return `${modulo}.${evento}`;
}

const ORDEN_CATEGORIAS = Object.keys(CATEGORIAS_AVISO) as CategoriaAviso[];

export const CLAVES_MATRIZ: ClaveMatriz[] = (Object.keys(MODULOS_AVISO) as ModuloAviso[]).flatMap((modulo) =>
  (Object.keys(EVENTOS_AVISO) as EventoAviso[])
    .filter((e) => definicionAviso(e).modulos.includes(modulo))
    .sort((a, b) => ORDEN_CATEGORIAS.indexOf(definicionAviso(a).categoria) - ORDEN_CATEGORIAS.indexOf(definicionAviso(b).categoria))
    .map((evento) => claveMatriz(modulo, evento))
);

const CONJUNTO_CLAVES = new Set<string>(CLAVES_MATRIZ);

export function esClaveMatriz(valor: string): valor is ClaveMatriz {
  return CONJUNTO_CLAVES.has(valor);
}

export function partirClave(clave: ClaveMatriz): { modulo: ModuloAviso; evento: EventoAviso } {
  const [modulo, evento] = clave.split(".") as [ModuloAviso, EventoAviso];
  return { modulo, evento };
}

export function clavesDeEvento(evento: EventoAviso): ClaveMatriz[] {
  return definicionAviso(evento).modulos.map((m) => claveMatriz(m, evento));
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function correoValido(valor: string | null | undefined): valor is string {
  return Boolean(valor && CORREO.test(valor));
}

export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function parametros() {
  const c = await db.configuracionSitio.findUnique({
    where: { id: "singleton" },
    select: { avisosCorreoActivos: true, urlPlataforma: true, correoPruebaAvisos: true },
  });
  return {
    activos: new Set<ClaveMatriz>((c?.avisosCorreoActivos ?? []).filter(esClaveMatriz)),
    urlPlataforma: c?.urlPlataforma ?? null,
    correoPrueba: c?.correoPruebaAvisos ?? null,
  };
}

export function urlBasePlataforma(configurada: string | null): string | null {
  const base =
    configurada?.trim() ||
    process.env.URL_PLATAFORMA?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return base ? base.replace(/\/+$/, "") : null;
}

export function enSegundoPlano(tarea: () => Promise<unknown>) {
  const segura = () => tarea().catch((e) => console.error("Aviso por correo falló:", e));
  try {
    after(segura);
  } catch {
    void segura();
  }
}

export function correoDeUsuario(u: { email: string; correoNotificacion: string | null }): string | null {
  const c = (u.correoNotificacion?.trim() || u.email).toLowerCase();
  return CORREO.test(c) ? c : null;
}

export async function correosPorUsuario(usuarioIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(usuarioIds)];
  if (ids.length === 0) return new Map();
  const usuarios = await db.usuario.findMany({ where: { id: { in: ids }, activo: true }, select: { id: true, email: true, correoNotificacion: true } });
  return new Map(
    usuarios.flatMap((u) => {
      const c = correoDeUsuario(u);
      return c ? [[u.id, c] as const] : [];
    })
  );
}

export async function direccionesSuprimidas(correos: string[]): Promise<Set<string>> {
  const unicos = [...new Set(correos)];
  if (unicos.length === 0) return new Set();
  const filas = await db.correoSuprimido.findMany({ where: { correo: { in: unicos } }, select: { correo: true } });
  return new Set(filas.map((f) => f.correo));
}

export type Mensaje = { asunto: string; titulo: string; cuerpoHtml: string; enlace?: { texto: string; ruta: string } };

export type Aviso = Mensaje & {
  evento: EventoAviso;
  modulo: ModuloAviso;
  clave: string;
  usuarioIds?: string[];
  correos?: (string | null | undefined)[];
};

export function renderizarMensaje(m: Mensaje, base: string | null, nota = ""): string {
  const enlace = m.enlace && base ? { texto: m.enlace.texto, url: `${base}${m.enlace.ruta}` } : undefined;
  return plantillaCorreo(escaparHtml(m.titulo), `${nota}${m.cuerpoHtml}`, enlace);
}

export const ENCABEZADO_ENVIO = "X-CDMB-Envio";
export const MOTIVO_SUPRIMIDA = "Dirección en la lista de supresión por rebote.";
export const MENSAJE_SIN_CONFIGURAR = "El correo institucional no está configurado o no tiene claves vigentes.";
export const SIN_CONFIGURAR: ResultadoEnvio = { ok: false, mensaje: MENSAJE_SIN_CONFIGURAR };
export const PAUSA_ENTRE_CORREOS_MS = 2_100;

const ESPERAS_REINTENTO_MIN = [10, 60, 360];
export const MAX_INTENTOS = ESPERAS_REINTENTO_MIN.length + 1;
export const CADUCIDAD_COLA_MS = 3 * 86_400_000;
const EN_CURSO_ATASCADO_MS = 15 * 60_000;

export function pausa(ms = PAUSA_ENTRE_CORREOS_MS) {
  return new Promise((listo) => setTimeout(listo, ms));
}

export function estadoTrasEnvio(r: ResultadoEnvio, intentos: number) {
  if (r.ok) return { estado: "ENVIADO" as EstadoCorreo, error: null, html: null, enviadoEn: new Date(), proximoIntento: null };
  const espera = r.permanente ? undefined : ESPERAS_REINTENTO_MIN[intentos - 1];
  return {
    estado: (espera === undefined ? "FALLIDO" : "REINTENTO") as EstadoCorreo,
    error: r.mensaje.slice(0, 1000),
    proximoIntento: espera === undefined ? null : new Date(Date.now() + espera * 60_000),
  };
}

async function reservarEnvio(aviso: Aviso, destinatario: string, html: string): Promise<{ id: string; envio: string } | null> {
  const envio = randomUUID();
  const datos = {
    destinatario,
    categoria: aviso.evento,
    modulo: aviso.modulo,
    asunto: aviso.asunto.slice(0, 300),
    html,
    envio,
    estado: "EN_CURSO" as EstadoCorreo,
    intentos: 1,
    intentadoEn: new Date(),
    error: null,
    proximoIntento: null,
  };
  const nuevo = await db.correoEnviado.create({ data: { clave: aviso.clave, ...datos }, select: { id: true } }).catch(() => null);
  if (nuevo) return { id: nuevo.id, envio };
  const reabierto = await db.correoEnviado.updateMany({ where: { clave: aviso.clave, destinatario, estado: "FALLIDO" }, data: datos });
  if (reabierto.count === 0) return null;
  const fila = await db.correoEnviado.findUnique({ where: { clave_destinatario: { clave: aviso.clave, destinatario } }, select: { id: true } });
  return fila ? { id: fila.id, envio } : null;
}

export async function eventosActivos(): Promise<Set<ClaveMatriz>> {
  const { activos } = await parametros();
  if (activos.size === 0 || !(await correoConfigurado())) return new Set();
  return activos;
}

function destinatariosDe(aviso: Aviso, correos: Map<string, string>): string[] {
  return [
    ...new Set([
      ...(aviso.usuarioIds ?? []).flatMap((id) => correos.get(id) ?? []),
      ...(aviso.correos ?? []).map((c) => c?.trim().toLowerCase() ?? "").filter((c) => CORREO.test(c)),
    ]),
  ];
}

export async function enviarAvisos(avisos: Aviso[]): Promise<number> {
  if (avisos.length === 0) return 0;
  const { activos, urlPlataforma } = await parametros();
  const aplican = avisos.filter((a) => activos.has(claveMatriz(a.modulo, a.evento)));
  if (aplican.length === 0) return 0;
  const correos = await correosPorUsuario(aplican.flatMap((a) => a.usuarioIds ?? []));
  const lista = aplican.map((aviso) => ({ aviso, destinatarios: destinatariosDe(aviso, correos) })).filter((x) => x.destinatarios.length > 0);
  if (lista.length === 0) return 0;
  const [envio, suprimidas] = await Promise.all([prepararEnvio(), direccionesSuprimidas(lista.flatMap((x) => x.destinatarios))]);
  const base = urlBasePlataforma(urlPlataforma);
  let enviados = 0;
  for (const { aviso, destinatarios } of lista) {
    const html = renderizarMensaje(aviso, base);
    for (const destinatario of destinatarios) {
      const fila = await reservarEnvio(aviso, destinatario, html);
      if (!fila) continue;
      if (suprimidas.has(destinatario)) {
        await db.correoEnviado.update({ where: { id: fila.id }, data: { estado: "OMITIDO", error: MOTIVO_SUPRIMIDA, html: null } });
        continue;
      }
      const r = envio ? await envio.enviar({ para: [destinatario], asunto: aviso.asunto, html, encabezados: { [ENCABEZADO_ENVIO]: fila.envio } }) : SIN_CONFIGURAR;
      await db.correoEnviado.update({ where: { id: fila.id }, data: estadoTrasEnvio(r, 1) });
      if (r.ok) enviados++;
    }
  }
  if (envio) {
    const enCola = await db.correoEnviado.count({ where: { estado: "REINTENTO", proximoIntento: { lte: new Date() } } });
    if (enCola > 0) await procesarColaCorreo({ limite: 5, presupuestoMs: 30_000 });
  }
  return enviados;
}

export function enviarAviso(aviso: Aviso): Promise<number> {
  return enviarAvisos([aviso]);
}

export function programarAvisos(claves: ClaveMatriz[], construir: () => Promise<Aviso | Aviso[] | null>) {
  enSegundoPlano(async () => {
    const { activos } = await parametros();
    if (!claves.some((c) => activos.has(c))) return;
    const avisos = await construir();
    if (avisos) await enviarAvisos(Array.isArray(avisos) ? avisos : [avisos]);
  });
}

export function avisarEnSegundoPlano(aviso: Aviso) {
  programarAvisos([claveMatriz(aviso.modulo, aviso.evento)], async () => aviso);
}

export type ResultadoCola = { liberados: number; caducados: number; procesados: number; enviados: number; reprogramados: number; fallidos: number; omitidos: number; motivo?: string };

export async function procesarColaCorreo(opciones: { limite?: number; presupuestoMs?: number } = {}): Promise<ResultadoCola> {
  const inicio = Date.now();
  const ahora = new Date(inicio);
  const atascado = new Date(inicio - EN_CURSO_ATASCADO_MS);
  const enCursoAtascado = { estado: "EN_CURSO" as EstadoCorreo, OR: [{ intentadoEn: { lt: atascado } }, { intentadoEn: null, createdAt: { lt: atascado } }] };
  const sinCuerpo = await db.correoEnviado.updateMany({
    where: { OR: [{ ...enCursoAtascado, html: null }, { estado: "REINTENTO", html: null }] },
    data: { estado: "FALLIDO", error: "El envío no terminó y no puede reintentarse; el proceso diario lo vuelve a generar si sigue vigente.", proximoIntento: null },
  });
  const liberados = await db.correoEnviado.updateMany({
    where: { ...enCursoAtascado, html: { not: null } },
    data: { estado: "REINTENTO", proximoIntento: ahora, error: "El envío anterior no terminó." },
  });
  const caducados = await db.correoEnviado.updateMany({
    where: { estado: "REINTENTO", intentos: { gte: 1 }, createdAt: { lt: new Date(inicio - CADUCIDAD_COLA_MS) } },
    data: { estado: "FALLIDO", error: "Caducó en la cola sin poder enviarse.", proximoIntento: null },
  });
  const r: ResultadoCola = { liberados: liberados.count + sinCuerpo.count, caducados: caducados.count, procesados: 0, enviados: 0, reprogramados: 0, fallidos: 0, omitidos: 0 };
  const pendientes = await db.correoEnviado.findMany({
    where: { estado: "REINTENTO", proximoIntento: { lte: ahora } },
    orderBy: { proximoIntento: "asc" },
    take: opciones.limite ?? 60,
    select: { id: true, destinatario: true, asunto: true, html: true, envio: true, intentos: true },
  });
  if (pendientes.length === 0) return r;
  const envio = await prepararEnvio();
  if (!envio) return { ...r, motivo: MENSAJE_SIN_CONFIGURAR };
  const suprimidas = await direccionesSuprimidas(pendientes.map((p) => p.destinatario));
  for (const p of pendientes) {
    if (Date.now() - inicio > (opciones.presupuestoMs ?? 120_000)) break;
    const tomado = await db.correoEnviado.updateMany({
      where: { id: p.id, estado: "REINTENTO" },
      data: { estado: "EN_CURSO", intentadoEn: new Date(), intentos: { increment: 1 } },
    });
    if (tomado.count === 0) continue;
    if (suprimidas.has(p.destinatario)) {
      await db.correoEnviado.update({ where: { id: p.id }, data: { estado: "OMITIDO", error: MOTIVO_SUPRIMIDA, html: null, proximoIntento: null } });
      r.omitidos++;
      continue;
    }
    if (r.procesados > 0) await pausa();
    r.procesados++;
    const resultado = await envio.enviar({ para: [p.destinatario], asunto: p.asunto, html: p.html!, encabezados: { [ENCABEZADO_ENVIO]: p.envio ?? p.id } });
    const estado = estadoTrasEnvio(resultado, p.intentos + 1);
    await db.correoEnviado.update({ where: { id: p.id }, data: estado });
    if (estado.estado === "ENVIADO") r.enviados++;
    else if (estado.estado === "REINTENTO") r.reprogramados++;
    else r.fallidos++;
  }
  return r;
}

export function parrafos(...lineas: (string | null | undefined | false)[]): string {
  return lineas
    .filter((l): l is string => Boolean(l))
    .map((l) => `<p style="margin:0 0 10px">${l}</p>`)
    .join("");
}

export function negrita(texto: string): string {
  return `<strong>${escaparHtml(texto)}</strong>`;
}
