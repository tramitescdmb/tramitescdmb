import { db } from "@/lib/db";
import { cargoDelFirmante, type ModuloFirma } from "@/lib/jerarquia-firma";
import { etiquetaCalidadCompleta } from "@/lib/calidad-firma";

export type FirmaPublica = {
  id: string;
  nombre: string;
  cargo: string;
  calidad: string;
  fechaHora: Date;
  selloTiempoEn: Date | null;
  hashFirma: string | null;
  entidad: string;
};

export type DocumentoFirmadoPublico = {
  codigo: string;
  plataforma: string;
  referencia: string;
  documento: string;
  hashArchivo: string | null;
  firmas: FirmaPublica[];
};

const SELECT_PERSONA = {
  nombre: true,
  denominacionEmpleo: true,
  denominacionComplemento: true,
  sexo: true,
  rolesContratacion: true,
} as const;

type Persona = { nombre: string; denominacionEmpleo: string | null; denominacionComplemento: string | null; sexo: string | null; rolesContratacion: string[] };

type FirmaFila = { id: string; fechaHora: Date; calidad: string | null; selloTiempoEn: Date | null; hashContenido: string; usuario: Persona };
type VistoFila = { id: string; completadoEn: Date | null; usuarioAsignado: Persona };

const ENTIDAD = "Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga — CDMB";

const entidadDe = (cargo: string) => (/contratista/i.test(cargo) ? `Contratista de la ${ENTIDAD}` : ENTIDAD);

function aPublicas(firmas: FirmaFila[], vistos: VistoFila[], modulo: ModuloFirma): FirmaPublica[] {
  return [
    ...firmas.map((f) => ({
      id: f.id,
      nombre: f.usuario.nombre,
      cargo: cargoDelFirmante(f.usuario, modulo),
      calidad: etiquetaCalidadCompleta({ rol: "FIRMA", calidad: f.calidad }),
      fechaHora: f.fechaHora,
      selloTiempoEn: f.selloTiempoEn,
      hashFirma: f.hashContenido,
      entidad: entidadDe(cargoDelFirmante(f.usuario, modulo)),
    })),
    ...vistos
      .filter((v) => v.completadoEn)
      .map((v) => ({
        id: v.id,
        nombre: v.usuarioAsignado.nombre,
        cargo: cargoDelFirmante(v.usuarioAsignado, modulo),
        calidad: "Visto bueno",
        fechaHora: v.completadoEn!,
        selloTiempoEn: null,
        hashFirma: null,
        entidad: entidadDe(cargoDelFirmante(v.usuarioAsignado, modulo)),
      })),
  ].sort((a, b) => a.fechaHora.getTime() - b.fechaHora.getTime());
}

const SELECT_FIRMA = { id: true, fechaHora: true, calidad: true, selloTiempoEn: true, hashContenido: true, usuario: { select: SELECT_PERSONA } } as const;
const SELECT_VISTOS = {
  where: { rol: "VISTO_BUENO", estado: "COMPLETADA" },
  select: { id: true, completadoEn: true, usuarioAsignado: { select: SELECT_PERSONA } },
} as const;

export const PLATAFORMA_FIRMA = {
  tramites: "Trámites ambientales 2.0",
  gecon: "GECON — Contratación",
  sgdea: "SGDEA — Correspondencia y Archivo",
} as const;

export type TipoDocumentoCsv = "T" | "G" | "A" | "C";

export function codigoVerificacion(tipo: TipoDocumentoCsv, id: string): string {
  const grupos = id.toUpperCase().match(/.{1,5}/g) ?? [];
  return `${tipo}-${grupos.join("-")}`;
}

export function parsearCodigoVerificacion(csv: string): { tipo: TipoDocumentoCsv; id: string } | null {
  const limpio = csv.trim().replace(/[^A-Za-z0-9]/g, "");
  const tipo = limpio.charAt(0).toUpperCase();
  const id = limpio.slice(1).toLowerCase();
  if (!["T", "G", "A", "C"].includes(tipo) || !/^[a-z0-9]{20,40}$/.test(id)) return null;
  return { tipo: tipo as TipoDocumentoCsv, id };
}

async function buscarDocumentos(filtro: { tipo: TipoDocumentoCsv; id: string }): Promise<DocumentoFirmadoPublico[]> {
  const por = (t: TipoDocumentoCsv) => (filtro.tipo === t ? { id: filtro.id } : null);
  const vacio = Promise.resolve([] as never[]);
  const [tramites, contratos, archivo, comunicaciones] = await Promise.all([
    por("T")
      ? db.expedienteDocumento.findMany({
          where: por("T")!,
          select: { id: true, nombre: true, hashSha256: true, expediente: { select: { numero: true } }, firmas: { select: SELECT_FIRMA }, solicitudesFirma: SELECT_VISTOS },
        })
      : vacio,
    por("G")
      ? db.documentoContrato.findMany({
          where: { ...por("G")!, expediente: { eliminado: false } },
          select: { id: true, nombre: true, hashSha256: true, expediente: { select: { numero: true } }, firmas: { select: SELECT_FIRMA }, solicitudesFirma: SELECT_VISTOS },
        })
      : vacio,
    por("A")
      ? db.documentoArchivo.findMany({
          where: { ...por("A")!, retiradoEn: null },
          select: { id: true, nombre: true, hashSha256: true, expediente: { select: { numero: true } }, firmas: { select: SELECT_FIRMA }, solicitudesFirma: SELECT_VISTOS },
        })
      : vacio,
    por("C")
      ? db.comunicacionDocumento.findMany({
          where: por("C")!,
          select: {
            id: true,
            nombre: true,
            hashSha256: true,
            comunicacion: { select: { radicado: true, firmas: { select: SELECT_FIRMA }, solicitudesFirma: SELECT_VISTOS } },
          },
        })
      : vacio,
  ]);
  return [
    ...tramites.map((d) => ({ codigo: codigoVerificacion("T", d.id), plataforma: PLATAFORMA_FIRMA.tramites, referencia: d.expediente.numero, documento: d.nombre, hashArchivo: d.hashSha256, firmas: aPublicas(d.firmas, d.solicitudesFirma, "TRAMITES") })),
    ...contratos.map((d) => ({ codigo: codigoVerificacion("G", d.id), plataforma: PLATAFORMA_FIRMA.gecon, referencia: d.expediente.numero, documento: d.nombre, hashArchivo: d.hashSha256, firmas: aPublicas(d.firmas, d.solicitudesFirma, "GECON") })),
    ...archivo.map((d) => ({ codigo: codigoVerificacion("A", d.id), plataforma: PLATAFORMA_FIRMA.sgdea, referencia: d.expediente.numero, documento: d.nombre, hashArchivo: d.hashSha256, firmas: aPublicas(d.firmas, d.solicitudesFirma, "SGDEA") })),
    ...comunicaciones.map((d) => ({
      codigo: codigoVerificacion("C", d.id),
      plataforma: PLATAFORMA_FIRMA.sgdea,
      referencia: d.comunicacion.radicado,
      documento: d.nombre,
      hashArchivo: d.hashSha256,
      firmas: aPublicas(d.comunicacion.firmas, d.comunicacion.solicitudesFirma, "SGDEA"),
    })),
  ];
}

export async function documentoFirmadoPorCodigo(csv: string): Promise<DocumentoFirmadoPublico[]> {
  const p = parsearCodigoVerificacion(csv);
  return p ? buscarDocumentos(p) : [];
}

export async function firmasDeComunicacion(comunicacionId: string): Promise<FirmaPublica[]> {
  const c = await db.comunicacion.findUnique({
    where: { id: comunicacionId },
    select: { firmas: { select: SELECT_FIRMA }, solicitudesFirma: SELECT_VISTOS },
  });
  return c ? aPublicas(c.firmas, c.solicitudesFirma, "SGDEA") : [];
}

export async function documentosFirmadosDeExpedienteTramite(expedienteId: string): Promise<{ documento: string; hashArchivo: string | null; firmas: FirmaPublica[] }[]> {
  const docs = await db.expedienteDocumento.findMany({
    where: { expedienteId, firmas: { some: {} } },
    orderBy: { createdAt: "asc" },
    select: { nombre: true, hashSha256: true, firmas: { select: SELECT_FIRMA }, solicitudesFirma: SELECT_VISTOS },
  });
  return docs.map((d) => ({ documento: d.nombre, hashArchivo: d.hashSha256, firmas: aPublicas(d.firmas, d.solicitudesFirma, "TRAMITES") }));
}

export async function documentosFirmadosDeContrato(expedienteId: string): Promise<{ documento: string; hashArchivo: string | null; firmas: FirmaPublica[] }[]> {
  const docs = await db.documentoContrato.findMany({
    where: { expedienteId, firmas: { some: {} } },
    orderBy: { createdAt: "asc" },
    select: { nombre: true, hashSha256: true, firmas: { select: SELECT_FIRMA }, solicitudesFirma: SELECT_VISTOS },
  });
  return docs.map((d) => ({ documento: d.nombre, hashArchivo: d.hashSha256, firmas: aPublicas(d.firmas, d.solicitudesFirma, "GECON") }));
}
