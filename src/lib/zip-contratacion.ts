import JSZip from "jszip";
import { db } from "@/lib/db";
import { descargarDocumento } from "@/lib/storage";
import { ETIQUETA_ETAPA, identidadFirmante } from "@/lib/contratacion";
import { conExtension } from "@/lib/uploads-config";
import { estamparFirmaSigec } from "@/lib/pdf-rotulado";
import { formatearFechaHoraLarga } from "@/lib/fecha";

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

async function agregarDocumentosExpediente(carpetaBase: JSZip, expedienteId: string, numeroExpediente: string, baseUrl: string) {
  const documentos = await db.documentoContrato.findMany({
    where: { expedienteId },
    orderBy: { createdAt: "asc" },
    select: {
      nombre: true,
      mimeType: true,
      etapa: true,
      storagePath: true,
      requisitoId: true,
      firmas: {
        orderBy: { fechaHora: "asc" },
        select: {
          fechaHora: true,
          hashContenido: true,
          calidad: true,
          usuario: {
            select: {
              nombre: true,
              cedulaONit: true,
              denominacionEmpleo: true,
              denominacionComplemento: true,
              sexo: true,
              dependencia: { select: { nombre: true } },
              contratista: { select: { identificacion: true, contactoEmail: true } },
            },
          },
        },
      },
      solicitudesFirma: {
        where: { rol: "VISTO_BUENO", estado: "COMPLETADA" },
        orderBy: { completadoEn: "asc" },
        select: {
          completadoEn: true,
          usuarioAsignado: {
            select: {
              nombre: true,
              cedulaONit: true,
              denominacionEmpleo: true,
              denominacionComplemento: true,
              sexo: true,
              dependencia: { select: { nombre: true } },
              contratista: { select: { identificacion: true, contactoEmail: true } },
            },
          },
        },
      },
    },
  });

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
        ? await estamparFirmaSigec(
            original,
            { numeroExpediente, baseUrl },
            [
            ...doc.firmas.map((f) => ({
              nombre: f.usuario.nombre,
              cedulaONit: identidadFirmante(f.usuario).cedulaONit,
              denominacionEmpleo: f.usuario.denominacionEmpleo,
              denominacionComplemento: f.usuario.denominacionComplemento,
              sexo: f.usuario.sexo,
              dependencia: f.usuario.dependencia?.nombre ?? null,
              fechaHora: formatearFechaHoraLarga(f.fechaHora),
              hash: f.hashContenido,
        calidad: f.calidad,
            })),
            ...doc.solicitudesFirma.map((s) => ({
              nombre: s.usuarioAsignado.nombre,
              cedulaONit: identidadFirmante(s.usuarioAsignado).cedulaONit,
              denominacionEmpleo: s.usuarioAsignado.denominacionEmpleo,
              denominacionComplemento: s.usuarioAsignado.denominacionComplemento,
              sexo: s.usuarioAsignado.sexo,
              dependencia: s.usuarioAsignado.dependencia?.nombre ?? null,
              fechaHora: s.completadoEn ? formatearFechaHoraLarga(s.completadoEn) : "",
              hash: "",
              calidad: "VISTO_BUENO",
            })),
            ]
          )
        : original;
    carpetaDestino.file(nombre, contenido);
  }
  return documentos.length;
}

export async function construirZipExpediente(expedienteId: string, numeroExpediente: string, baseUrl: string): Promise<Buffer> {
  const zip = new JSZip();
  await agregarDocumentosExpediente(zip, expedienteId, numeroExpediente, baseUrl);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function construirZipMasivo(expedientes: { id: string; numero: string; numeroContrato: string | null }[], baseUrl: string): Promise<Buffer> {
  const zip = new JSZip();
  const usados = new Set<string>();
  for (const e of expedientes) {
    const nombreCarpeta = nombreUnico(usados, sanearNombreZip((e.numeroContrato ?? e.numero)));
    const carpeta = zip.folder(nombreCarpeta)!;
    await agregarDocumentosExpediente(carpeta, e.id, e.numero, baseUrl);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
