import { db } from "@/lib/db";
import type { MedioComunicacion, TipoSolicitante } from "@prisma/client";
import { generarRadicado } from "@/lib/radicado";

/**
 * Dominio de correspondencia (SGDEA). Fase 1: radicación de comunicaciones
 * RECIBIDAS en la ventanilla única. El radicado se genera atómicamente dentro
 * de la misma transacción que crea la comunicación (ver src/lib/radicado.ts):
 * si la creación falla, el número se revierte con la transacción, sin huecos.
 */

export type EntradaTercero = {
  tipo: TipoSolicitante;
  tipoIdentificacion?: string | null; // CC, CE, NIT, PA, TI, ANONIMO...
  identificacion?: string | null;
  nombre: string; // razón social o nombre completo tal como llega
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  municipio?: string | null;
};

export type EntradaDocumento = {
  path: string;
  nombre: string;
  descripcion?: string | null;
  mimeType: string;
  tamanoBytes: number;
  hashSha256?: string | null;
};

export type EntradaRadicacionRecibida = {
  asunto: string;
  folios: number;
  anexosDescripcion?: string | null;
  medio?: MedioComunicacion | null;
  tercero: EntradaTercero;
  dependenciaDestinoId?: string | null;
  serieId?: string | null;
  subserieId?: string | null;
  documentos?: EntradaDocumento[];
  radicadoPorId: string;
};

export async function radicarRecibida(entrada: EntradaRadicacionRecibida) {
  return db.$transaction(async (tx) => {
    const { radicado, anio } = await generarRadicado("RECIBIDA", new Date().getFullYear(), tx);

    // Se vincula al maestro Solicitante SOLO si el remitente viene identificado
    // y con municipio (Solicitante.municipio es obligatorio). Si no, se guarda
    // únicamente el snapshot en la comunicación — no se ensucia el maestro con
    // datos incompletos de un remitente ocasional.
    let terceroId: string | null = null;
    const ident = entrada.tercero.identificacion?.trim() || null;
    const muni = entrada.tercero.municipio?.trim() || null;
    if (ident && muni) {
      const esJuridica = entrada.tercero.tipo === "JURIDICA";
      const solicitante = await tx.solicitante.upsert({
        where: { identificacion: ident },
        create: {
          tipo: entrada.tercero.tipo,
          identificacion: ident,
          razonSocial: esJuridica ? entrada.tercero.nombre : null,
          nombres: esJuridica ? null : entrada.tercero.nombre,
          email: entrada.tercero.email ?? null,
          telefono: entrada.tercero.telefono ?? null,
          direccion: entrada.tercero.direccion ?? null,
          municipio: muni,
        },
        update: {
          email: entrada.tercero.email ?? undefined,
          telefono: entrada.tercero.telefono ?? undefined,
          direccion: entrada.tercero.direccion ?? undefined,
        },
      });
      terceroId = solicitante.id;
    }

    const comunicacion = await tx.comunicacion.create({
      data: {
        tipo: "RECIBIDA",
        radicado,
        anio,
        medio: entrada.medio ?? null,
        origen: "VENTANILLA",
        estado: "RADICADA",
        asunto: entrada.asunto,
        folios: entrada.folios,
        anexosDescripcion: entrada.anexosDescripcion ?? null,
        terceroId,
        terceroTipo: entrada.tercero.tipo,
        terceroTipoIdentificacion: entrada.tercero.tipoIdentificacion ?? null,
        terceroIdentificacion: ident,
        terceroNombre: entrada.tercero.nombre,
        terceroEmail: entrada.tercero.email ?? null,
        terceroTelefono: entrada.tercero.telefono ?? null,
        terceroDireccion: entrada.tercero.direccion ?? null,
        terceroMunicipio: muni,
        dependenciaDestinoId: entrada.dependenciaDestinoId ?? null,
        serieId: entrada.serieId ?? null,
        subserieId: entrada.subserieId ?? null,
        radicadoPorId: entrada.radicadoPorId,
      },
    });

    if (entrada.documentos?.length) {
      await tx.comunicacionDocumento.createMany({
        data: entrada.documentos.map((doc) => ({
          comunicacionId: comunicacion.id,
          nombre: doc.nombre,
          descripcion: doc.descripcion ?? null,
          storagePath: doc.path,
          mimeType: doc.mimeType,
          tamanoBytes: doc.tamanoBytes,
          hashSha256: doc.hashSha256 ?? null,
          subidoPorId: entrada.radicadoPorId,
        })),
      });
    }

    return comunicacion;
  });
}
