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
  rolContratacion: true,
} as const;

type Persona = { nombre: string; denominacionEmpleo: string | null; denominacionComplemento: string | null; sexo: string | null; rolContratacion: string | null };

type FirmaFila = { id: string; fechaHora: Date; calidad: string | null; selloTiempoEn: Date | null; hashContenido: string; usuario: Persona };
type VistoFila = { id: string; completadoEn: Date | null; usuarioAsignado: Persona };

const ENTIDAD = "Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga — CDMB";

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
      entidad: ENTIDAD,
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
        entidad: ENTIDAD,
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

export async function documentosFirmadosPorHash(hashSha256: string): Promise<DocumentoFirmadoPublico[]> {
  const hash = hashSha256.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return [];
  const [tramites, contratos, archivo, comunicaciones] = await Promise.all([
    db.expedienteDocumento.findMany({
      where: { hashSha256: hash },
      select: { nombre: true, hashSha256: true, expediente: { select: { numero: true } }, firmas: { select: SELECT_FIRMA }, solicitudesFirma: SELECT_VISTOS },
    }),
    db.documentoContrato.findMany({
      where: { hashSha256: hash },
      select: { nombre: true, hashSha256: true, expediente: { select: { numero: true } }, firmas: { select: SELECT_FIRMA }, solicitudesFirma: SELECT_VISTOS },
    }),
    db.documentoArchivo.findMany({
      where: { hashSha256: hash, retiradoEn: null },
      select: { nombre: true, hashSha256: true, expediente: { select: { numero: true } }, firmas: { select: SELECT_FIRMA }, solicitudesFirma: SELECT_VISTOS },
    }),
    db.comunicacionDocumento.findMany({
      where: { hashSha256: hash },
      select: {
        nombre: true,
        hashSha256: true,
        comunicacion: { select: { radicado: true, firmas: { select: SELECT_FIRMA }, solicitudesFirma: SELECT_VISTOS } },
      },
    }),
  ]);
  return [
    ...tramites.map((d) => ({ plataforma: PLATAFORMA_FIRMA.tramites, referencia: d.expediente.numero, documento: d.nombre, hashArchivo: d.hashSha256, firmas: aPublicas(d.firmas, d.solicitudesFirma, "TRAMITES") })),
    ...contratos.map((d) => ({ plataforma: PLATAFORMA_FIRMA.gecon, referencia: d.expediente.numero, documento: d.nombre, hashArchivo: d.hashSha256, firmas: aPublicas(d.firmas, d.solicitudesFirma, "GECON") })),
    ...archivo.map((d) => ({ plataforma: PLATAFORMA_FIRMA.sgdea, referencia: d.expediente.numero, documento: d.nombre, hashArchivo: d.hashSha256, firmas: aPublicas(d.firmas, d.solicitudesFirma, "SGDEA") })),
    ...comunicaciones.map((d) => ({
      plataforma: PLATAFORMA_FIRMA.sgdea,
      referencia: d.comunicacion.radicado,
      documento: d.nombre,
      hashArchivo: d.hashSha256,
      firmas: aPublicas(d.comunicacion.firmas, d.comunicacion.solicitudesFirma, "SGDEA"),
    })),
  ];
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
