import { db } from "@/lib/db";
import { registrarAuditoriaDoc } from "@/lib/auditoria-doc";

/**
 * Acciones de dominio sobre un ExpedienteDocumento que tocan su firma electrónica — editar
 * (reemplazar el archivo) invalida cualquier firma o solicitud ya registrada, porque quedarían
 * sobre un contenido que ya no existe. La regla de QUIÉN puede editar/eliminar un documento de
 * Trámites es la de siempre (ver src/lib/documentos.ts, puedeIntentarEliminarDocumento); esto solo
 * cubre lo que pasa con la firma cuando esa edición sí ocurre.
 */
export async function editarDocumentoTramite(
  documentoId: string,
  datos: {
    nombre?: string;
    descripcion?: string | null;
    requiereFirma?: boolean;
    archivo?: { storagePath: string; mimeType: string; tamanoBytes: number; hashSha256: string | null };
  }
): Promise<{ storagePathAnterior: string | null }> {
  const nombre = datos.nombre?.trim();
  const anterior = datos.archivo
    ? await db.expedienteDocumento.findUnique({ where: { id: documentoId }, select: { storagePath: true } })
    : null;
  if (datos.archivo && !anterior) throw new Error("El documento no existe.");

  await db.expedienteDocumento.update({
    where: { id: documentoId },
    data: {
      ...(nombre ? { nombre } : {}),
      ...(datos.descripcion !== undefined ? { descripcion: datos.descripcion?.trim() || null } : {}),
      ...(datos.requiereFirma !== undefined ? { requiereFirma: datos.requiereFirma } : {}),
      ...(datos.archivo
        ? {
            storagePath: datos.archivo.storagePath,
            mimeType: datos.archivo.mimeType,
            tamanoBytes: datos.archivo.tamanoBytes,
            hashSha256: datos.archivo.hashSha256,
            estadoValidacion: "PENDIENTE" as const,
            validadoPorId: null,
            validadoEn: null,
          }
        : {}),
    },
  });

  if (datos.archivo) {
    await db.firmaExpedienteDocumento.deleteMany({ where: { documentoId } });
    await db.solicitudFirma.deleteMany({ where: { documentoExpedienteId: documentoId } });
    await db.avisoRechazoDocumento.deleteMany({ where: { documentoExpedienteId: documentoId } });
  }

  return { storagePathAnterior: anterior?.storagePath ?? null };
}

/** Marca un documento del expediente como validado manualmente — confirma que alguien ya lo
 * revisó, aparte de la aprobación automática que ocurre al completarse una firma. */
export async function validarDocumentoTramite(
  documentoId: string,
  usuarioId: string,
  peticion?: { ip?: string | null; userAgent?: string | null }
) {
  const doc = await db.expedienteDocumento.findUnique({
    where: { id: documentoId },
    select: { id: true, nombre: true, expedienteId: true, pasoNumero: true, estadoValidacion: true },
  });
  if (!doc) throw new Error("El documento no existe.");
  if (doc.estadoValidacion === "APROBADO") throw new Error("Este documento ya está aprobado.");

  await db.expedienteDocumento.update({
    where: { id: documentoId },
    data: { estadoValidacion: "APROBADO", validadoPorId: usuarioId, validadoEn: new Date() },
  });
  const detalle = `Se validó "${doc.nombre}".`;
  await db.expedienteEvento.create({
    data: {
      expedienteId: doc.expedienteId,
      tipo: "DOCUMENTO_VALIDADO",
      descripcion: detalle,
      pasoNumero: doc.pasoNumero,
      usuarioId,
    },
  });
  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumento",
    entidadId: documentoId,
    accion: "VALIDA",
    usuarioId,
    ip: peticion?.ip ?? null,
    userAgent: peticion?.userAgent ?? null,
    detalle,
  });
}

/** Avisos de documentos rechazados visibles para este usuario: los que él mismo subió (para
 * poder corregirlos) y, si administra el módulo, todos los del sistema. */
export async function listarAvisosRechazoTramiteParaUsuario(usuarioId: string, veTodos: boolean) {
  const avisos = await db.avisoRechazoDocumento.findMany({
    where: { documentoExpedienteId: { not: null }, ...(veTodos ? {} : { subidoPorId: usuarioId }) },
    orderBy: { createdAt: "desc" },
    include: {
      documentoExpediente: { select: { id: true, nombre: true, mimeType: true, firmas: { select: { id: true } }, expedienteId: true, expediente: { select: { numero: true } } } },
      rechazadoPor: { select: { nombre: true } },
      subidoPor: { select: { nombre: true } },
    },
  });
  return avisos as (typeof avisos[number] & { documentoExpediente: NonNullable<(typeof avisos)[number]["documentoExpediente"]> })[];
}
