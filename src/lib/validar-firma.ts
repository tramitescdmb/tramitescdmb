import { db } from "@/lib/db";
import { cargoDelFirmante, type ModuloFirma } from "@/lib/jerarquia-firma";
import { etiquetaCalidadCompleta } from "@/lib/calidad-firma";
import { registroDocumentoTramite, SELECT_REGISTRO_TRAMITE, type DetalleRegistro } from "@/lib/registro-documento";
import { ETIQUETA_ETAPA } from "@/lib/contratacion-etiquetas";

export type FirmaPublica = {
  id: string;
  nombre: string;
  cargo: string;
  actoAdministrativo: string | null;
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
  /** A qué registro pertenece el documento (expediente, trámite, etapa, tipo). Sin datos personales. */
  registro: DetalleRegistro[];
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

type FirmaFila = { id: string; fechaHora: Date; calidad: string | null; selloTiempoEn: Date | null; hashContenido: string; cargoAlFirmar: string | null; actoAdministrativoAlFirmar: string | null; usuario: Persona };
type VistoFila = { id: string; completadoEn: Date | null; cargoAlFirmar: string | null; actoAdministrativoAlFirmar: string | null; usuarioAsignado: Persona };

const ENTIDAD = "Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga — CDMB";

function aPublicas(firmas: FirmaFila[], vistos: VistoFila[], modulo: ModuloFirma): FirmaPublica[] {
  return [
    ...firmas.map((f) => {
      const cargo = f.cargoAlFirmar ?? cargoDelFirmante(f.usuario, modulo);
      return {
        id: f.id,
        nombre: f.usuario.nombre,
        cargo,
        actoAdministrativo: f.actoAdministrativoAlFirmar,
        calidad: etiquetaCalidadCompleta({ rol: "FIRMA", calidad: f.calidad }),
        fechaHora: f.fechaHora,
        selloTiempoEn: f.selloTiempoEn,
        hashFirma: f.hashContenido,
        entidad: ENTIDAD,
      };
    }),
    ...vistos
      .filter((v) => v.completadoEn)
      .map((v) => {
        const cargo = v.cargoAlFirmar ?? cargoDelFirmante(v.usuarioAsignado, modulo);
        return {
          id: v.id,
          nombre: v.usuarioAsignado.nombre,
          cargo,
          actoAdministrativo: v.actoAdministrativoAlFirmar,
          calidad: "Visto bueno",
          fechaHora: v.completadoEn!,
          selloTiempoEn: null,
          hashFirma: null,
          entidad: ENTIDAD,
        };
      }),
  ].sort((a, b) => a.fechaHora.getTime() - b.fechaHora.getTime());
}

const SELECT_FIRMA = { id: true, fechaHora: true, calidad: true, selloTiempoEn: true, hashContenido: true, cargoAlFirmar: true, actoAdministrativoAlFirmar: true, usuario: { select: SELECT_PERSONA } } as const;
const SELECT_VISTOS = {
  where: { rol: "VISTO_BUENO", estado: "COMPLETADA" },
  select: { id: true, completadoEn: true, cargoAlFirmar: true, actoAdministrativoAlFirmar: true, usuarioAsignado: { select: SELECT_PERSONA } },
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
          select: { id: true, nombre: true, hashSha256: true, ...SELECT_REGISTRO_TRAMITE, firmas: { select: SELECT_FIRMA }, solicitudesFirma: SELECT_VISTOS },
        })
      : vacio,
    por("G")
      ? db.documentoContrato.findMany({
          where: { ...por("G")!, expediente: { eliminado: false } },
          select: { id: true, nombre: true, hashSha256: true, etapa: true, tipoDocumental: { select: { nombre: true } }, expediente: { select: { numero: true } }, firmas: { select: SELECT_FIRMA }, solicitudesFirma: SELECT_VISTOS },
        })
      : vacio,
    por("A")
      ? db.documentoArchivo.findMany({
          where: { ...por("A")!, retiradoEn: null },
          select: { id: true, nombre: true, hashSha256: true, tipoDocumental: { select: { nombre: true } }, expediente: { select: { numero: true } }, firmas: { select: SELECT_FIRMA }, solicitudesFirma: SELECT_VISTOS },
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
    ...tramites.map((d) => ({ codigo: codigoVerificacion("T", d.id), plataforma: PLATAFORMA_FIRMA.tramites, referencia: d.expediente.numero, documento: d.nombre, hashArchivo: d.hashSha256, registro: registroDocumentoTramite(d), firmas: aPublicas(d.firmas, d.solicitudesFirma, "TRAMITES") })),
    ...contratos.map((d) => ({ codigo: codigoVerificacion("G", d.id), plataforma: PLATAFORMA_FIRMA.gecon, referencia: d.expediente.numero, documento: d.nombre, hashArchivo: d.hashSha256, registro: [
      { etiqueta: "Expediente contractual", valor: d.expediente.numero },
      { etiqueta: "Etapa", valor: ETIQUETA_ETAPA[d.etapa] },
      ...(d.tipoDocumental ? [{ etiqueta: "Tipo de documento", valor: d.tipoDocumental.nombre }] : []),
    ], firmas: aPublicas(d.firmas, d.solicitudesFirma, "GECON") })),
    ...archivo.map((d) => ({ codigo: codigoVerificacion("A", d.id), plataforma: PLATAFORMA_FIRMA.sgdea, referencia: d.expediente.numero, documento: d.nombre, hashArchivo: d.hashSha256, registro: [
      { etiqueta: "Expediente documental", valor: d.expediente.numero },
      ...(d.tipoDocumental ? [{ etiqueta: "Tipo de documento", valor: d.tipoDocumental.nombre }] : []),
    ], firmas: aPublicas(d.firmas, d.solicitudesFirma, "SGDEA") })),
    ...comunicaciones.map((d) => ({
      codigo: codigoVerificacion("C", d.id),
      plataforma: PLATAFORMA_FIRMA.sgdea,
      referencia: d.comunicacion.radicado,
      documento: d.nombre,
      hashArchivo: d.hashSha256,
      registro: [{ etiqueta: "Radicado", valor: d.comunicacion.radicado }],
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
