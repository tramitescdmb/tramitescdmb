import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { partesColombia } from "@/lib/planeador";
import { codigoProcedimiento } from "@/lib/temas-visita";
import { validarEstructura, type DatosPrecarga, type EstructuraFormato } from "@/lib/formato-visita";
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

export async function formatoVigenteParaTramite(codigoTramite: string): Promise<FormatoVigente | null> {
  const codigo = codigoProcedimiento(codigoTramite);
  const formato = await db.formatoVisita.findFirst({
    where: { activo: true, tramites: { has: codigo } },
    orderBy: { updatedAt: "desc" },
    include: { versiones: { where: { estado: "PUBLICADA" }, orderBy: { numero: "desc" }, take: 1 } },
  });
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
          solicitanteNombre: true,
          solicitanteIdentificacion: true,
          solicitanteTelefono: true,
          solicitanteEmail: true,
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
    solicitante: e.solicitanteNombre,
    identificacion: e.solicitanteIdentificacion,
    telefono: e.solicitanteTelefono ?? undefined,
    correo: e.solicitanteEmail ?? undefined,
    municipio: e.municipio,
    predio: e.predioNombre ?? undefined,
    matricula: e.predioMatricula ?? undefined,
    catastral: e.predioCatastral ?? undefined,
    direccion_predio: e.predioDireccion ?? undefined,
    area_predio: areaHa(e.predioAreaM2),
    funcionario: v.profesional.nombre,
    fecha_visita: partesColombia(fechaVisita ?? v.fechaHora).fecha,
  };
  return Object.fromEntries(Object.entries(datos).filter(([, x]) => x)) as DatosPrecarga;
}

export function tramitesEnUso(formatos: { id: string; tramites: string[]; activo: boolean }[], excluirId?: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of formatos) if (f.activo && f.id !== excluirId) for (const t of f.tramites) m.set(t, f.id);
  return m;
}

export async function sembrarFormatosBase(usuarioId: string): Promise<{ creados: string[]; omitidos: string[] }> {
  const creados: string[] = [];
  const omitidos: string[] = [];
  const existentes = await db.formatoVisita.findMany({ select: { id: true, codigo: true, tramites: true, activo: true } });
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
