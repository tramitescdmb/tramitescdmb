import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { identidadFirmante } from "@/lib/contratacion";
import { cargoDelFirmante, nivelFirma } from "@/lib/jerarquia-firma";
import { formatearFechaHoraLarga } from "@/lib/fecha";
import { metadatosPdf } from "@/lib/metadatos-pdf";
import type { DatosFirmaGecon, FirmaRotuloPdf } from "@/lib/pdf-rotulado";

const SELECT_FIRMANTE = {
  id: true,
  nombre: true,
  cedulaONit: true,
  tipoIdentificacionFirma: true,
  denominacionEmpleo: true,
  denominacionComplemento: true,
  sexo: true,
  rolesContratacion: true,
  dependencia: { select: { nombre: true } },
  contratista: { select: { identificacion: true, contactoEmail: true, tipoPersona: true } },
} satisfies Prisma.UsuarioSelect;

export const SELECT_FIRMAS_DOCUMENTO_GECON = {
  firmas: {
    orderBy: { fechaHora: "asc" },
    select: { fechaHora: true, hashContenido: true, calidad: true, cargoAlFirmar: true, usuario: { select: SELECT_FIRMANTE } },
  },
  solicitudesFirma: {
    where: { rol: "VISTO_BUENO", estado: "COMPLETADA" },
    orderBy: { completadoEn: "asc" },
    select: { completadoEn: true, cargoAlFirmar: true, usuarioAsignado: { select: SELECT_FIRMANTE } },
  },
} satisfies Prisma.DocumentoContratoSelect;

type DocumentoConFirmas = Prisma.DocumentoContratoGetPayload<{ select: typeof SELECT_FIRMAS_DOCUMENTO_GECON }>;
type Firmante = Prisma.UsuarioGetPayload<{ select: typeof SELECT_FIRMANTE }>;

export async function supervisoresDelExpediente(expedienteId: string): Promise<Set<string>> {
  const filas = await db.expedienteContractualSupervisor.findMany({ where: { expedienteId }, select: { usuarioId: true } });
  return new Set(filas.map((f) => f.usuarioId));
}

function persona(u: Firmante, supervisores: Set<string>, cargoAlFirmar?: string | null) {
  const identidad = identidadFirmante(u);
  const conContexto = { ...u, supervisaElExpediente: supervisores.has(u.id) };
  return {
    nombre: u.nombre,
    cedulaONit: identidad.cedulaONit,
    tipoIdentificacion: identidad.tipoIdentificacion,
    denominacionEmpleo: u.denominacionEmpleo,
    denominacionComplemento: u.denominacionComplemento,
    sexo: u.sexo,
    dependencia: u.dependencia?.nombre ?? null,
    // Preferimos el cargo congelado al momento de firmar; solo si la firma es anterior a este
    // campo (null) recurrimos al cargo actual del usuario como antes.
    cargo: cargoAlFirmar ?? cargoDelFirmante(conContexto, "GECON"),
    nivel: nivelFirma(conContexto),
  };
}

export function firmantesDocumentoGecon(doc: DocumentoConFirmas, supervisores: Set<string>): FirmaRotuloPdf[] {
  return [
    ...doc.firmas.map((f) => ({
      ...persona(f.usuario, supervisores, f.cargoAlFirmar),
      fechaHora: formatearFechaHoraLarga(f.fechaHora),
      hash: f.hashContenido,
      calidad: f.calidad,
    })),
    ...doc.solicitudesFirma.map((s) => ({
      ...persona(s.usuarioAsignado, supervisores, s.cargoAlFirmar),
      fechaHora: s.completadoEn ? formatearFechaHoraLarga(s.completadoEn) : "",
      hash: "",
      calidad: "VISTO_BUENO",
    })),
  ];
}

export function datosRotuloGecon(doc: { id: string; nombre: string; hashSha256: string | null }, numeroExpediente: string, baseUrl: string): DatosFirmaGecon {
  return {
    numeroExpediente,
    baseUrl,
    metadatos: metadatosPdf({ tipo: "G", id: doc.id, baseUrl, documento: doc.nombre, referencia: numeroExpediente, hashArchivo: doc.hashSha256 }),
  };
}
