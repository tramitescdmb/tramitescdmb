import JSZip from "jszip";
import { db } from "@/lib/db";
import { descargarDocumento } from "@/lib/storage";
import { ETIQUETA_ETAPA, identidadFirmante } from "@/lib/contratacion";
import { conExtension } from "@/lib/uploads-config";
import { estamparFirmaSigec } from "@/lib/pdf-rotulado";
import { formatearFechaHoraLarga } from "@/lib/fecha";

/** Tope de expedientes por descarga masiva — evita agotar tiempo/memoria del runtime
 * serverless de Vercel si el filtro trae demasiados. Pedido explícito del usuario (2026-09-18). */
export const MAX_EXPEDIENTES_ZIP_MASIVO = 50;

/** JSZip (como casi cualquier lector de zip) trata "/" y "\" como separador de carpeta dentro de
 * un nombre de archivo — varios nombres del catálogo los llevan literalmente (ej. "Estudio del
 * sector / estudio de mercado", con la barra como parte del nombre, no como jerarquía) y eso creaba
 * subcarpetas por accidente con un archivo roto adentro. Se reemplazan por un guión visualmente
 * parecido antes de escribir al zip — el nombre real en la base de datos no se toca. */
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

/** Agrega al ZIP los documentos de UN expediente, en carpetas por etapa (solo esas 3 — nunca una
 * subcarpeta por documento). Única excepción: cuando un mismo requisito del catálogo tiene VARIOS
 * documentos (ej. el Informe de supervisión, uno por periodo/mes), esos quedan juntos en una
 * subcarpeta con el nombre del requisito — evita una fila larga de archivos casi idénticos sueltos
 * en la carpeta de la etapa. `carpetaBase` es el folder de JSZip donde colgar las subcarpetas de
 * etapa (la raíz del zip, o la carpeta del expediente cuando se arma un ZIP masivo de varios).
 * Un PDF que ya tiene al menos una firma se agrega ESTAMPADO (sello + QR de verificación, la misma
 * versión que sirve `/api/contratacion-documentos/[id]/rotulado` y que ya se ve en "Mis firmas") en
 * vez del original sin firma — pedido explícito del usuario (2026-09-23): antes el ZIP siempre
 * bajaba el archivo crudo, incluso para uno ya firmado. */
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
    },
  });

  // Nombre del REQUISITO (no el del documento, que para los que se entregan por periodos ya lleva
  // el número/rango pegado, ej. "Informe de supervisión 3 (…)") — se usa como nombre de la
  // subcarpeta cuando aplica.
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
      doc.mimeType === "application/pdf" && doc.firmas.length > 0
        ? await estamparFirmaSigec(
            original,
            { numeroExpediente, baseUrl },
            doc.firmas.map((f) => ({
              nombre: f.usuario.nombre,
              cedulaONit: identidadFirmante(f.usuario).cedulaONit,
              denominacionEmpleo: f.usuario.denominacionEmpleo,
              denominacionComplemento: f.usuario.denominacionComplemento,
              sexo: f.usuario.sexo,
              dependencia: f.usuario.dependencia?.nombre ?? null,
              fechaHora: formatearFechaHoraLarga(f.fechaHora),
              hash: f.hashContenido,
            }))
          )
        : original;
    carpetaDestino.file(nombre, contenido);
  }
  return documentos.length;
}

/** ZIP de un solo expediente contractual, con una carpeta por etapa (Precontractual/Contractual/
 * Postcontractual) — pedido explícito del usuario para poder entregarle todo un expediente a un
 * peticionario de una sola vez. `baseUrl` es el origen (protocolo+host) de la petición que pidió el
 * ZIP — lo necesita el QR de verificación de cada PDF ya firmado que se estampe. */
export async function construirZipExpediente(expedienteId: string, numeroExpediente: string, baseUrl: string): Promise<Buffer> {
  const zip = new JSZip();
  await agregarDocumentosExpediente(zip, expedienteId, numeroExpediente, baseUrl);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** ZIP de varios expedientes a la vez — una carpeta de nivel superior por expediente (nombrada por
 * su número de contrato real si existe, o el consecutivo de SIGEC), con las mismas subcarpetas por
 * etapa adentro. El llamador es responsable de aplicar `MAX_EXPEDIENTES_ZIP_MASIVO` antes de
 * invocar esta función (aquí solo arma el archivo). */
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
