import JSZip from "jszip";
import { db } from "@/lib/db";
import { descargarDocumento } from "@/lib/storage";
import { ETIQUETA_ETAPA } from "@/lib/contratacion";
import { conExtension } from "@/lib/uploads-config";
import { estamparFirmaGecon } from "@/lib/pdf-rotulado";
import { SELECT_FIRMAS_DOCUMENTO_GECON, datosRotuloGecon, firmantesDocumentoGecon, supervisoresDelExpediente } from "@/lib/firmantes-gecon";

export const MAX_EXPEDIENTES_ZIP_MASIVO = 50;

function sanearNombreZip(nombre: string): string {
  return nombre.replace(/[\\/]+/g, " - ").trim();
}

function nombreUnico(usados: Set<string>, nombre: string): string {
  if (!usados.has(nombre)) {
    usados.add(nombre);
    return nombre;
  }
  const punto = nombre.lastIndexOf(".");
  const base = punto > 0 ? nombre.slice(0, punto) : nombre;
  const ext = punto > 0 ? nombre.slice(punto) : "";
  let i = 2;
  let candidato = `${base} (${i})${ext}`;
  while (usados.has(candidato)) {
    i += 1;
    candidato = `${base} (${i})${ext}`;
  }
  usados.add(candidato);
  return candidato;
}

async function agregarDocumentosExpediente(
  carpetaBase: JSZip,
  expedienteId: string,
  numeroExpediente: string,
  baseUrl: string,
  ocultarPrecontractual: boolean
) {
  const [documentos, supervisores] = await Promise.all([
    db.documentoContrato.findMany({
      where: { expedienteId, ...(ocultarPrecontractual ? { etapa: { not: "PRECONTRACTUAL" } } : {}) },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        nombre: true,
        mimeType: true,
        etapa: true,
        storagePath: true,
        hashSha256: true,
        requisitoId: true,
        ...SELECT_FIRMAS_DOCUMENTO_GECON,
      },
    }),
    supervisoresDelExpediente(expedienteId),
  ]);

  const idsRequisito = [...new Set(documentos.map((d) => d.requisitoId).filter((id): id is string => Boolean(id)))];
  const requisitos = idsRequisito.length
    ? await db.requisitoDocumentoContratacion.findMany({ where: { id: { in: idsRequisito } }, select: { id: true, nombre: true } })
    : [];
  const nombreRequisitoPorId = new Map(requisitos.map((r) => [r.id, r.nombre]));

  const porEtapaYRequisito = new Map<string, number>();
  for (const doc of documentos) {
    if (!doc.requisitoId) continue;
    const clave = `${doc.etapa}::${doc.requisitoId}`;
    porEtapaYRequisito.set(clave, (porEtapaYRequisito.get(clave) ?? 0) + 1);
  }

  const usadosPorCarpeta = new Map<string, Set<string>>();
  for (const doc of documentos) {
    const carpetaEtapa = carpetaBase.folder(ETIQUETA_ETAPA[doc.etapa]) ?? carpetaBase;
    const clave = doc.requisitoId ? `${doc.etapa}::${doc.requisitoId}` : null;
    const variosDelMismoRequisito = clave ? (porEtapaYRequisito.get(clave) ?? 0) > 1 : false;
    const carpetaDestino =
      variosDelMismoRequisito && doc.requisitoId
        ? (carpetaEtapa.folder(sanearNombreZip(nombreRequisitoPorId.get(doc.requisitoId) ?? "Otros")) ?? carpetaEtapa)
        : carpetaEtapa;

    const claveCarpeta = variosDelMismoRequisito ? `${clave}` : doc.etapa;
    if (!usadosPorCarpeta.has(claveCarpeta)) usadosPorCarpeta.set(claveCarpeta, new Set());
    const nombre = nombreUnico(usadosPorCarpeta.get(claveCarpeta)!, sanearNombreZip(conExtension(doc.nombre, doc.mimeType)));
    const original = await descargarDocumento(doc.storagePath);
    const contenido =
      doc.mimeType === "application/pdf" && (doc.firmas.length > 0 || doc.solicitudesFirma.length > 0)
        ? await estamparFirmaGecon(original, datosRotuloGecon(doc, numeroExpediente, baseUrl), firmantesDocumentoGecon(doc, supervisores))
        : original;
    carpetaDestino.file(nombre, contenido);
  }
  return documentos.length;
}

export async function construirZipExpediente(
  expedienteId: string,
  numeroExpediente: string,
  baseUrl: string,
  ocultarPrecontractual: boolean
): Promise<Buffer> {
  const zip = new JSZip();
  await agregarDocumentosExpediente(zip, expedienteId, numeroExpediente, baseUrl, ocultarPrecontractual);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function construirZipMasivo(
  expedientes: { id: string; numero: string; numeroContrato: string | null }[],
  baseUrl: string,
  ocultarPrecontractual: boolean
): Promise<Buffer> {
  const zip = new JSZip();
  const usados = new Set<string>();
  for (const e of expedientes) {
    const nombreCarpeta = nombreUnico(usados, sanearNombreZip((e.numeroContrato ?? e.numero)));
    const carpeta = zip.folder(nombreCarpeta)!;
    await agregarDocumentosExpediente(carpeta, e.id, e.numero, baseUrl, ocultarPrecontractual);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
