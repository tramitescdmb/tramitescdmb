import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { partesColombia } from "@/lib/planeador";
import { codigoProcedimiento, pasoPermiteVisita } from "@/lib/temas-visita";
import { TEXTO_TIPO_PERSONA, validarEstructura, type DatosPrecarga, type EstructuraFormato } from "@/lib/formato-visita";
import { FORMATOS_BASE } from "@/lib/formatos-visita-base";

export type FormatoVigente = {
  formatoId: string;
  versionId: string;
  numero: number;
  codigo: string;
  nombre: string;
  titulo: string;
  versionDocumento: string;
  fechaDocumento: string | null;
  estructura: EstructuraFormato;
};

export function estructuraDesdeJson(valor: Prisma.JsonValue | null | undefined): EstructuraFormato {
  const r = validarEstructura(valor);
  return "error" in r ? { secciones: [] } : r.estructura;
}

export async function formatoVigenteParaTramite(codigoTramite: string, formatoDelPasoId?: string | null): Promise<FormatoVigente | null> {
  const codigo = codigoProcedimiento(codigoTramite);
  const incluir = { versiones: { where: { estado: "PUBLICADA" as const }, orderBy: { numero: "desc" as const }, take: 1 } };
  const delPaso = formatoDelPasoId ? await db.formatoVisita.findFirst({ where: { id: formatoDelPasoId, activo: true }, include: incluir }) : null;
  const propio = delPaso?.versiones[0]
    ? delPaso
    : await db.formatoVisita.findFirst({ where: { activo: true, tramites: { has: codigo } }, orderBy: { updatedAt: "desc" }, include: incluir });
  const formato = propio?.versiones[0] ? propio : await db.formatoVisita.findFirst({ where: { activo: true, porDefecto: true }, orderBy: { updatedAt: "desc" }, include: incluir });
  const version = formato?.versiones[0];
  if (!formato || !version) return null;
  return {
    formatoId: formato.id,
    versionId: version.id,
    numero: version.numero,
    codigo: formato.codigo,
    nombre: formato.nombre,
    titulo: formato.titulo,
    versionDocumento: formato.versionDocumento,
    fechaDocumento: formato.fechaDocumento,
    estructura: estructuraDesdeJson(version.estructura),
  };
}

function areaHa(m2: number | null): string | undefined {
  if (m2 == null) return undefined;
  return (m2 / 10_000).toLocaleString("es-CO", { maximumFractionDigits: 4 });
}

export async function precargaDeVisita(visitaId: string, fechaVisita?: Date): Promise<DatosPrecarga> {
  const v = await db.visitaProgramada.findUnique({
    where: { id: visitaId },
    select: {
      fechaHora: true,
      profesional: { select: { nombre: true } },
      expediente: {
        select: {
          numero: true,
          municipio: true,
          solicitanteTipo: true,
          solicitanteNombre: true,
          solicitanteIdentificacion: true,
          solicitanteTelefono: true,
          solicitanteEmail: true,
          solicitanteDireccion: true,
          ubicacionLat: true,
          ubicacionLon: true,
          solicitante: { select: { email: true, celular: true, telefono: true, direccion: true } },
          predioNombre: true,
          predioMatricula: true,
          predioCatastral: true,
          predioDireccion: true,
          predioAreaM2: true,
          tramiteTipo: { select: { nombre: true } },
        },
      },
    },
  });
  if (!v) return {};
  const e = v.expediente;
  const datos: DatosPrecarga = {
    expediente: e.numero,
    tramite: e.tramiteTipo.nombre,
    tipo_solicitante: TEXTO_TIPO_PERSONA[e.solicitanteTipo],
    solicitante: e.solicitanteNombre,
    identificacion: e.solicitanteIdentificacion,
    nit: e.solicitanteTipo === "JURIDICA" ? e.solicitanteIdentificacion : undefined,
    telefono: e.solicitanteTelefono || e.solicitante?.celular || e.solicitante?.telefono || undefined,
    correo: e.solicitanteEmail || e.solicitante?.email || undefined,
    direccion_solicitante: e.solicitanteDireccion || e.solicitante?.direccion || undefined,
    municipio: e.municipio,
    predio: e.predioNombre ?? undefined,
    matricula: e.predioMatricula ?? undefined,
    catastral: e.predioCatastral ?? undefined,
    direccion_predio: e.predioDireccion ?? undefined,
    area_predio: areaHa(e.predioAreaM2),
    coordenadas: e.ubicacionLat != null && e.ubicacionLon != null ? `${e.ubicacionLat},${e.ubicacionLon}` : undefined,
    funcionario: v.profesional.nombre,
    fecha_visita: partesColombia(fechaVisita ?? v.fechaHora).fecha,
  };
  return Object.fromEntries(Object.entries(datos).filter(([, x]) => x)) as DatosPrecarga;
}

export type CoberturaTramite = {
  codigo: string;
  nombre: string;
  pasosVisita: string[];
  formato: { id: string; nombre: string; codigo: string; propio: boolean; publicado: boolean } | null;
};

export async function coberturaFormatos(): Promise<CoberturaTramite[]> {
  const [tipos, formatos] = await Promise.all([
    db.tramiteTipo.findMany({
      where: { activo: true },
      select: {
        codigo: true,
        nombre: true,
        flujos: { select: { pasos: { select: { numero: true, titulo: true, descripcion: true, tipoActividad: true, formatoVisitaId: true }, orderBy: { numero: "asc" } } } },
      },
      orderBy: { codigo: "asc" },
    }),
    db.formatoVisita.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, codigo: true, tramites: true, porDefecto: true, _count: { select: { versiones: { where: { estado: "PUBLICADA" } } } } },
    }),
  ]);
  const generico = formatos.find((f) => f.porDefecto);
  const r: CoberturaTramite[] = [];
  for (const t of tipos) {
    const pasos = t.flujos.flatMap((f) => f.pasos).filter((p) => pasoPermiteVisita(p.titulo, p.descripcion, p.tipoActividad));
    if (pasos.length === 0) continue;
    const codigo = codigoProcedimiento(t.codigo);
    const idDelPaso = pasos.find((p) => p.formatoVisitaId)?.formatoVisitaId;
    const propio = formatos.find((f) => f.id === idDelPaso) ?? formatos.find((f) => f.tramites.includes(codigo));
    const f = propio ?? generico;
    r.push({
      codigo: t.codigo,
      nombre: t.nombre,
      pasosVisita: [...new Set(pasos.map((p) => `${p.numero}. ${p.titulo.charAt(0)}${p.titulo.slice(1).toLowerCase()}`))],
      formato: f ? { id: f.id, nombre: f.nombre, codigo: f.codigo, propio: !!propio, publicado: f._count.versiones > 0 } : null,
    });
  }
  return r;
}

export function tramitesEnUso(formatos: { id: string; tramites: string[]; activo: boolean }[], excluirId?: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of formatos) if (f.activo && f.id !== excluirId) for (const t of f.tramites) m.set(t, f.id);
  return m;
}

export async function sembrarFormatosBase(usuarioId: string): Promise<{ creados: string[]; omitidos: string[] }> {
  const creados: string[] = [];
  const omitidos: string[] = [];
  const existentes = await db.formatoVisita.findMany({ select: { id: true, codigo: true, tramites: true, activo: true, porDefecto: true } });
  const enUso = tramitesEnUso(existentes);
  for (const base of FORMATOS_BASE) {
    if (existentes.some((f) => f.codigo === base.codigo)) {
      omitidos.push(base.codigo);
      continue;
    }
    const validada = validarEstructura(JSON.parse(JSON.stringify(base.estructura)));
    if ("error" in validada) throw new Error(`${base.codigo}: ${validada.error}`);
    await db.formatoVisita.create({
      data: {
        codigo: base.codigo,
        nombre: base.nombre,
        titulo: base.titulo,
        versionDocumento: base.version,
        fechaDocumento: base.fechaFormato || null,
        tramites: base.tramites.filter((t) => !enUso.has(t)),
        porDefecto: !!base.porDefecto && !existentes.some((f) => f.activo && f.porDefecto),
        creadoPorId: usuarioId,
        versiones: {
          create: {
            numero: 1,
            estado: "PUBLICADA",
            estructura: validada.estructura as unknown as Prisma.InputJsonValue,
            nota: "Versión inicial transcrita del formato oficial.",
            creadoPorId: usuarioId,
            publicadaEn: new Date(),
            publicadaPorId: usuarioId,
          },
        },
      },
    });
    creados.push(base.codigo);
  }
  return { creados, omitidos };
}
