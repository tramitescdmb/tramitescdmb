import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashContenidoFirma } from "@/lib/firma";
import { huellaVerificada } from "@/lib/hash-archivo";

type ClienteDb = Pick<Prisma.TransactionClient, "comunicacionDocumento">;

export type ComunicacionFirmable = {
  id: string;
  tipo: string;
  estado: string;
  radicado: string;
  asunto: string;
  contenido: string | null;
  respuestaTexto: string | null;
};

/** Antes de firmar, comprueba que la huella de cada adjunto que entra en la firma sea la del archivo guardado. */
export async function verificarHuellasAdjuntos(c: Pick<ComunicacionFirmable, "id" | "tipo">): Promise<void> {
  const esRespuesta = c.tipo === "RECIBIDA";
  const [documentos, firmasPrevias] = await Promise.all([
    db.comunicacionDocumento.findMany({
      where: { comunicacionId: c.id, ...(esRespuesta ? { esRespuesta: true } : {}) },
      select: { id: true, storagePath: true, hashSha256: true },
    }),
    db.firma.count({ where: { comunicacionId: c.id } }),
  ]);
  for (const d of documentos) {
    await huellaVerificada(d, firmasPrevias, (h) => db.comunicacionDocumento.update({ where: { id: d.id }, data: { hashSha256: h } }));
  }
}

export async function hashFirmaComunicacion(c: ComunicacionFirmable, fechaHora: Date, cliente: ClienteDb = db): Promise<string> {
  const esRespuesta = c.tipo === "RECIBIDA";
  const documentos = await cliente.comunicacionDocumento.findMany({
    where: { comunicacionId: c.id, ...(esRespuesta ? { esRespuesta: true } : {}) },
    select: { hashSha256: true },
    orderBy: { createdAt: "asc" },
  });
  return hashContenidoFirma({
    radicado: c.radicado,
    asunto: esRespuesta ? `Respuesta a ${c.radicado} — ${c.asunto}` : c.asunto,
    contenido: esRespuesta ? c.respuestaTexto : c.contenido,
    fechaIso: fechaHora.toISOString(),
    hashesDocumentos: documentos.map((d) => d.hashSha256),
  });
}

export async function validarComunicacionFirmable(c: ComunicacionFirmable): Promise<void> {
  if (c.estado === "ANULADA") throw new Error("No se puede firmar una comunicación anulada.");
  if (c.tipo !== "RECIBIDA") return;
  const [salidas, documentosRespuesta] = await Promise.all([
    db.comunicacion.count({ where: { respondeAId: c.id } }),
    db.comunicacionDocumento.count({ where: { comunicacionId: c.id, esRespuesta: true } }),
  ]);
  if (salidas > 0) throw new Error("La respuesta ya se radicó como oficio de salida: las firmas se gestionan en ese oficio.");
  if (!c.respuestaTexto?.trim() && documentosRespuesta === 0) {
    throw new Error("Todavía no hay una respuesta que firmar: el funcionario asignado debe guardarla primero.");
  }
}

export const SELECT_COMUNICACION_FIRMABLE = {
  id: true,
  tipo: true,
  estado: true,
  radicado: true,
  asunto: true,
  contenido: true,
  respuestaTexto: true,
} as const;
