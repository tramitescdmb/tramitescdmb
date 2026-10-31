import { after } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { correoConfigurado, enviarCorreo, plantillaCorreo } from "@/lib/correo-microsoft";

export type GrupoAviso = "FIRMAS" | "VISITAS" | "CONCEPTOS" | "VENCIMIENTOS" | "EXTERNOS";

export const GRUPOS_AVISO: Record<GrupoAviso, string> = {
  FIRMAS: "Firmas y vistos buenos",
  VISITAS: "Visitas técnicas",
  CONCEPTOS: "Conceptos técnicos",
  VENCIMIENTOS: "Alertas de vencimiento",
  EXTERNOS: "Ciudadanos y solicitantes",
};

type DefinicionAviso = { grupo: GrupoAviso; modulo: string; evento: string; destinatarios: string; plataforma: string };

export const EVENTOS_AVISO = {
  FIRMA_SOLICITADA: {
    grupo: "FIRMAS",
    modulo: "Trámites · GECON · SGDEA",
    evento: "Se solicita firmar o dar visto bueno a un documento",
    destinatarios: "Persona asignada",
    plataforma: "Buzón de firmas",
  },
  FIRMA_RECORDADA: {
    grupo: "FIRMAS",
    modulo: "Trámites · GECON · SGDEA",
    evento: "Un firmante posterior recuerda una firma pendiente",
    destinatarios: "Firmante con turno anterior",
    plataforma: "Buzón de firmas · campana",
  },
  FIRMA_RECHAZADA: {
    grupo: "FIRMAS",
    modulo: "Trámites · GECON · SGDEA",
    evento: "Se rechaza una firma o un visto bueno",
    destinatarios: "Quien cargó o proyectó el documento",
    plataforma: "Avisos de rechazo",
  },
  VISITA_SIN_PROGRAMAR: {
    grupo: "VISITAS",
    modulo: "Trámites ambientales",
    evento: "Un expediente llega a un paso que requiere visita técnica",
    destinatarios: "Planificadores del trámite",
    plataforma: "Campana",
  },
  VISITA_NO_REALIZADA: {
    grupo: "VISITAS",
    modulo: "Trámites ambientales",
    evento: "Una visita no se realizó y debe reprogramarse",
    destinatarios: "Planificadores del trámite",
    plataforma: "Campana",
  },
  VISITA_PROGRAMADA: {
    grupo: "VISITAS",
    modulo: "Planeador de visitas",
    evento: "Se programa una visita o se agrega a alguien al equipo",
    destinatarios: "Profesional y equipo de la visita",
    plataforma: "Campana · calendario",
  },
  VISITA_REPROGRAMADA: {
    grupo: "VISITAS",
    modulo: "Planeador de visitas",
    evento: "Se cambia la fecha, hora o lugar de una visita",
    destinatarios: "Profesional y equipo de la visita",
    plataforma: "Campana · calendario",
  },
  VISITA_CANCELADA: {
    grupo: "VISITAS",
    modulo: "Planeador de visitas",
    evento: "Se cancela una visita",
    destinatarios: "Profesional y equipo de la visita",
    plataforma: "Campana · calendario",
  },
  CONCEPTO_POR_ELABORAR: {
    grupo: "CONCEPTOS",
    modulo: "Trámites ambientales",
    evento: "El expediente llega al paso de concepto técnico",
    destinatarios: "Personal asignado al expediente",
    plataforma: "Campana",
  },
  CONCEPTO_EN_REVISION: {
    grupo: "CONCEPTOS",
    modulo: "Planeador de visitas",
    evento: "Un concepto se envía a revisión",
    destinatarios: "Planificadores del trámite",
    plataforma: "Campana",
  },
  CONCEPTO_DEVUELTO: {
    grupo: "CONCEPTOS",
    modulo: "Planeador de visitas",
    evento: "Un concepto se devuelve o se reabre para corrección",
    destinatarios: "Quienes elaboran el concepto",
    plataforma: "Campana",
  },
  CONCEPTO_FIRMADO: {
    grupo: "CONCEPTOS",
    modulo: "Planeador de visitas",
    evento: "Todo el equipo firmó el concepto",
    destinatarios: "Profesional, equipo y quien finalizó",
    plataforma: "Campana",
  },
  CONCEPTO_RECHAZADO: {
    grupo: "CONCEPTOS",
    modulo: "Planeador de visitas",
    evento: "Se rechaza la firma de un concepto",
    destinatarios: "Profesional, equipo y quien finalizó",
    plataforma: "Campana",
  },
  PQRSD_POR_VENCER: {
    grupo: "VENCIMIENTOS",
    modulo: "SGDEA",
    evento: "PQRSD a 3 días hábiles o menos de vencer, o vencida",
    destinatarios: "Funcionario asignado; si no hay, quienes reparten",
    plataforma: "Mi trabajo · inicio",
  },
  MEMORANDO_POR_VENCER: {
    grupo: "VENCIMIENTOS",
    modulo: "SGDEA",
    evento: "Memorando a 1 día hábil o menos de su plazo, o vencido",
    destinatarios: "Destinatarios del memorando",
    plataforma: "Memorandos · inicio",
  },
  FLUJO_POR_VENCER: {
    grupo: "VENCIMIENTOS",
    modulo: "Trámites · GECON · SGDEA",
    evento: "Paso de flujo a 1 día hábil o menos de su término, o vencido",
    destinatarios: "Responsable personal del paso (no dependencias ni cargos)",
    plataforma: "Tareas del flujo",
  },
  INFORME_ATRASADO: {
    grupo: "VENCIMIENTOS",
    modulo: "GECON",
    evento: "Informe o evidencias del período sin radicar (al día 1 y al día 10 de retraso)",
    destinatarios: "Contratista y supervisores",
    plataforma: "Panel GECON · inicio",
  },
  FIRMA_SIN_ATENDER: {
    grupo: "VENCIMIENTOS",
    modulo: "Trámites · GECON · SGDEA",
    evento: "Firma que ya es su turno sin atender (a los 3 y a los 10 días)",
    destinatarios: "Persona asignada",
    plataforma: "Buzón de firmas",
  },
  PQRSD_RADICADO: {
    grupo: "EXTERNOS",
    modulo: "SGDEA",
    evento: "Se radica una PQRSD (web o ventanilla)",
    destinatarios: "Ciudadano, si dejó correo",
    plataforma: "—",
  },
  PQRSD_RESPUESTA: {
    grupo: "EXTERNOS",
    modulo: "SGDEA",
    evento: "Se despacha el oficio que responde una PQRSD",
    destinatarios: "Ciudadano, si dejó correo",
    plataforma: "—",
  },
  TRAMITE_RADICADO: {
    grupo: "EXTERNOS",
    modulo: "Trámites ambientales",
    evento: "Se radica un expediente de trámite",
    destinatarios: "Solicitante, si tiene correo",
    plataforma: "—",
  },
} satisfies Record<string, DefinicionAviso>;

export type EventoAviso = keyof typeof EVENTOS_AVISO;

export function esEventoAviso(valor: string): valor is EventoAviso {
  return valor in EVENTOS_AVISO;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function huella(texto: string): string {
  return createHash("sha256").update(texto).digest("hex").slice(0, 12);
}

export async function parametros() {
  const c = await db.configuracionSitio.findUnique({ where: { id: "singleton" }, select: { avisosCorreoDesactivados: true, urlPlataforma: true } });
  return { desactivados: new Set(c?.avisosCorreoDesactivados ?? []), urlPlataforma: c?.urlPlataforma ?? null };
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

export async function correosDeUsuarios(usuarioIds: string[]): Promise<string[]> {
  if (usuarioIds.length === 0) return [];
  const usuarios = await db.usuario.findMany({ where: { id: { in: [...new Set(usuarioIds)] }, activo: true }, select: { email: true, correoNotificacion: true } });
  return usuarios.map((u) => (u.correoNotificacion?.trim() || u.email).toLowerCase()).filter((c) => CORREO.test(c));
}

export type Aviso = {
  evento: EventoAviso;
  clave: string;
  usuarioIds?: string[];
  correos?: (string | null | undefined)[];
  asunto: string;
  titulo: string;
  cuerpoHtml: string;
  enlace?: { texto: string; ruta: string };
};

async function reservarEnvio(aviso: Aviso, destinatario: string): Promise<{ id: string } | null> {
  const datos = { clave: aviso.clave, destinatario, categoria: aviso.evento, asunto: aviso.asunto.slice(0, 300) };
  const nuevo = await db.correoEnviado.create({ data: datos, select: { id: true } }).catch(() => null);
  if (nuevo) return nuevo;
  const previo = await db.correoEnviado.findUnique({ where: { clave_destinatario: { clave: aviso.clave, destinatario } }, select: { id: true, ok: true } });
  return previo && !previo.ok ? { id: previo.id } : null;
}

export async function yaEnviado(clave: string, destinatario: string): Promise<boolean> {
  const fila = await db.correoEnviado.findUnique({ where: { clave_destinatario: { clave, destinatario } }, select: { ok: true } });
  return Boolean(fila?.ok);
}

export async function eventosActivos(): Promise<Set<EventoAviso>> {
  if (!(await correoConfigurado())) return new Set();
  const { desactivados } = await parametros();
  return new Set((Object.keys(EVENTOS_AVISO) as EventoAviso[]).filter((e) => !desactivados.has(e)));
}

export async function enviarAviso(aviso: Aviso): Promise<number> {
  if (!(await correoConfigurado())) return 0;
  const { desactivados, urlPlataforma } = await parametros();
  if (desactivados.has(aviso.evento)) return 0;
  const destinatarios = [
    ...new Set([
      ...(await correosDeUsuarios(aviso.usuarioIds ?? [])),
      ...(aviso.correos ?? []).map((c) => c?.trim().toLowerCase() ?? "").filter((c) => CORREO.test(c)),
    ]),
  ];
  if (destinatarios.length === 0) return 0;
  const base = urlBasePlataforma(urlPlataforma);
  const enlace = aviso.enlace && base ? { texto: aviso.enlace.texto, url: `${base}${aviso.enlace.ruta}` } : undefined;
  const html = plantillaCorreo(escaparHtml(aviso.titulo), aviso.cuerpoHtml, enlace);
  let enviados = 0;
  for (const destinatario of destinatarios) {
    const reservado = await reservarEnvio(aviso, destinatario);
    if (!reservado) continue;
    const r = await enviarCorreo({ para: [destinatario], asunto: aviso.asunto, html });
    await db.correoEnviado.update({ where: { id: reservado.id }, data: { ok: r.ok, error: r.ok ? null : r.mensaje.slice(0, 1000) } });
    if (r.ok) enviados++;
  }
  return enviados;
}

export function avisarEnSegundoPlano(aviso: Aviso) {
  enSegundoPlano(() => enviarAviso(aviso));
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
