import JSZip from "jszip";
import { db } from "@/lib/db";
import { descargarDocumento } from "@/lib/storage";
import { ETIQUETA_ETAPA } from "@/lib/contratacion";

/** Tope de expedientes por descarga masiva — evita agotar tiempo/memoria del runtime
 * serverless de Vercel si el filtro trae demasiados. Pedido explícito del usuario (2026-09-18). */
export const MAX_EXPEDIENTES_ZIP_MASIVO = 50;

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

/** Agrega al ZIP los documentos de UN expediente, en carpetas por etapa. `carpetaBase` es el
 * folder de JSZip donde colgar las subcarpetas de etapa (la raíz del zip, o la carpeta del
 * expediente cuando se arma un ZIP masivo de varios). */
async function agregarDocumentosExpediente(carpetaBase: JSZip, expedienteId: string) {
  const documentos = await db.documentoContrato.findMany({
    where: { expedienteId },
    orderBy: { createdAt: "asc" },
    select: { nombre: true, etapa: true, storagePath: true },
  });

  const usadosPorEtapa = new Map<string, Set<string>>();
  for (const doc of documentos) {
    const carpetaEtapa = carpetaBase.folder(ETIQUETA_ETAPA[doc.etapa]) ?? carpetaBase;
    if (!usadosPorEtapa.has(doc.etapa)) usadosPorEtapa.set(doc.etapa, new Set());
    const nombre = nombreUnico(usadosPorEtapa.get(doc.etapa)!, doc.nombre);
    const contenido = await descargarDocumento(doc.storagePath);
    carpetaEtapa.file(nombre, contenido);
  }
  return documentos.length;
}

/** ZIP de un solo expediente contractual, con una carpeta por etapa (Precontractual/Contractual/
 * Postcontractual) — pedido explícito del usuario para poder entregarle todo un expediente a un
 * peticionario de una sola vez. */
export async function construirZipExpediente(expedienteId: string): Promise<Buffer> {
  const zip = new JSZip();
  await agregarDocumentosExpediente(zip, expedienteId);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** ZIP de varios expedientes a la vez — una carpeta de nivel superior por expediente (nombrada por
 * su número de contrato real si existe, o el consecutivo de SIGEC), con las mismas subcarpetas por
 * etapa adentro. El llamador es responsable de aplicar `MAX_EXPEDIENTES_ZIP_MASIVO` antes de
 * invocar esta función (aquí solo arma el archivo). */
export async function construirZipMasivo(expedientes: { id: string; numero: string; numeroContrato: string | null }[]): Promise<Buffer> {
  const zip = new JSZip();
  const usados = new Set<string>();
  for (const e of expedientes) {
    const nombreCarpeta = nombreUnico(usados, (e.numeroContrato ?? e.numero).replace(/[\\/]/g, "-"));
    const carpeta = zip.folder(nombreCarpeta)!;
    await agregarDocumentosExpediente(carpeta, e.id);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
