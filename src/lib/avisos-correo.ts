import { after } from "next/server";
import { db } from "@/lib/db";
import { correoConfigurado, plantillaCorreo, prepararEnvio } from "@/lib/correo-microsoft";

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
    evento: "Firma o visto bueno sin atender a los 3 y a los 10 días, cuando ya es su turno",
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

export function correoDeUsuario(u: { email: string; correoNotificacion: string | null }): string | null {
  const c = (u.correoNotificacion?.trim() || u.email).toLowerCase();
  return CORREO.test(c) ? c : null;
}

export async function correosPorUsuario(usuarioIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(usuarioIds)];
  if (ids.length === 0) return new Map();
  const usuarios = await db.usuario.findMany({ where: { id: { in: ids }, activo: true }, select: { id: true, email: true, correoNotificacion: true } });
  return new Map(usuarios.flatMap((u) => {
    const c = correoDeUsuario(u);
    return c ? [[u.id, c] as const] : [];
  }));
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
  const previo = await db.correoEnviado.findUnique({ where: { clave_destinatario: { clave: aviso.clave, destinatario } }, select: { id: true, ok: true, error: true } });
  return previo && !previo.ok && previo.error ? { id: previo.id } : null;
}

export async function eventosActivos(): Promise<Set<EventoAviso>> {
  const { desactivados } = await parametros();
  const activos = (Object.keys(EVENTOS_AVISO) as EventoAviso[]).filter((e) => !desactivados.has(e));
  if (activos.length === 0 || !(await correoConfigurado())) return new Set();
  return new Set(activos);
}

export async function enviarAvisos(avisos: Aviso[]): Promise<number> {
  if (avisos.length === 0) return 0;
  const { desactivados, urlPlataforma } = await parametros();
  const aplican = avisos.filter((a) => !desactivados.has(a.evento));
  if (aplican.length === 0) return 0;
  const envio = await prepararEnvio();
  if (!envio) return 0;
  const correos = await correosPorUsuario(aplican.flatMap((a) => a.usuarioIds ?? []));
  const base = urlBasePlataforma(urlPlataforma);
  let enviados = 0;
  for (const aviso of aplican) {
    const destinatarios = [
      ...new Set([
        ...(aviso.usuarioIds ?? []).flatMap((id) => correos.get(id) ?? []),
        ...(aviso.correos ?? []).map((c) => c?.trim().toLowerCase() ?? "").filter((c) => CORREO.test(c)),
      ]),
    ];
    if (destinatarios.length === 0) continue;
    const enlace = aviso.enlace && base ? { texto: aviso.enlace.texto, url: `${base}${aviso.enlace.ruta}` } : undefined;
    const html = plantillaCorreo(escaparHtml(aviso.titulo), aviso.cuerpoHtml, enlace);
    for (const destinatario of destinatarios) {
      const reservado = await reservarEnvio(aviso, destinatario);
      if (!reservado) continue;
      const r = await envio.enviar({ para: [destinatario], asunto: aviso.asunto, html });
      await db.correoEnviado.update({ where: { id: reservado.id }, data: { ok: r.ok, error: r.ok ? null : r.mensaje.slice(0, 1000) } });
      if (r.ok) enviados++;
    }
  }
  return enviados;
}

export function enviarAviso(aviso: Aviso): Promise<number> {
  return enviarAvisos([aviso]);
}

export function programarAvisos(eventos: EventoAviso[], construir: () => Promise<Aviso | Aviso[] | null>) {
  enSegundoPlano(async () => {
    const { desactivados } = await parametros();
    if (eventos.every((e) => desactivados.has(e))) return;
    const avisos = await construir();
    if (avisos) await enviarAvisos(Array.isArray(avisos) ? avisos : [avisos]);
  });
}

export function avisarEnSegundoPlano(aviso: Aviso) {
  programarAvisos([aviso.evento], async () => aviso);
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
