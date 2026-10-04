import { db } from "@/lib/db";
import {
  puedeFirmar,
  puedeGestionarExpedienteDeDependencia,
  puedeVerNivelAccesoExpediente,
  type PermisosUsuario,
} from "@/lib/permisos";
import { listarBuzon } from "@/lib/solicitudes-firma";
import { resumirPendientesFirma, type ResumenPendientesFirma } from "@/lib/calidad-firma";

export async function accesoDocumentoArchivo(permisos: PermisosUsuario, usuarioId: string, documentoArchivoId: string) {
  const doc = await db.documentoArchivo.findUnique({
    where: { id: documentoArchivoId },
    select: {
      id: true,
      nombre: true,
      mimeType: true,
      storagePath: true,
      hashSha256: true,
      retiradoEn: true,
      expedienteDocumentalId: true,
      expediente: { select: { numero: true, asunto: true, estado: true, dependenciaId: true, nivelAcceso: true } },
    },
  });
  if (!doc) return null;
  const vinculado =
    (await db.solicitudFirma.count({ where: { documentoArchivoId, usuarioAsignadoId: usuarioId } })) > 0 ||
    (await db.firma.count({ where: { documentoArchivoId, usuarioId } })) > 0;
  const gestiona = puedeGestionarExpedienteDeDependencia(permisos, doc.expediente.dependenciaId);
  return {
    doc,
    puedeVer: vinculado || puedeVerNivelAccesoExpediente(permisos, doc.expediente),
    puedeSolicitar: gestiona,
    puedeFirmarDirecto: gestiona && puedeFirmar(permisos),
  };
}

export async function listarBuzonSgdea(usuarioId: string) {
  const [comunicaciones, archivos] = await Promise.all([
    listarBuzon(usuarioId, "comunicacion"),
    listarBuzon(usuarioId, "documentoArchivo"),
  ]);
  return [...comunicaciones, ...archivos].sort((a, b) => a.asignadoEn.getTime() - b.asignadoEn.getTime());
}

export async function contarPendientesBuzonSgdea(usuarioId: string): Promise<ResumenPendientesFirma> {
  return resumirPendientesFirma(await listarBuzonSgdea(usuarioId));
}

function filtroAvisosSgdea(usuarioId: string, veTodos: boolean) {
  return {
    OR: [{ comunicacionId: { not: null } }, { documentoArchivoId: { not: null } }],
    ...(veTodos ? {} : { subidoPorId: usuarioId }),
  };
}

export async function contarRechazosPorAtenderSgdea(usuarioId: string, veTodos: boolean): Promise<number> {
  return db.avisoRechazoDocumento.count({ where: filtroAvisosSgdea(usuarioId, veTodos) });
}

export async function listarAvisosRechazoSgdea(usuarioId: string, veTodos: boolean) {
  return db.avisoRechazoDocumento.findMany({
    where: filtroAvisosSgdea(usuarioId, veTodos),
    orderBy: { createdAt: "desc" },
    include: {
      rechazadoPor: { select: { nombre: true } },
      subidoPor: { select: { nombre: true } },
      comunicacion: { select: { id: true, radicado: true, asunto: true } },
      documentoArchivo: { select: { id: true, nombre: true, mimeType: true, expedienteDocumentalId: true, expediente: { select: { numero: true } } } },
    },
  });
}

export type RechazoSgdea = {
  id: string;
  titulo: string;
  referencia: string;
  enlace: string;
  motivo: string;
  rechazadoPor: string;
  fecha: Date;
};

export async function listarHistorialRechazosSgdea(usuarioId: string, veTodos: boolean): Promise<RechazoSgdea[]> {
  const solicitudes = await db.solicitudFirma.findMany({
    where: {
      estado: "RECHAZADA",
      OR: veTodos
        ? [{ comunicacionId: { not: null } }, { documentoArchivoId: { not: null } }]
        : [
            { usuarioAsignadoId: usuarioId, OR: [{ comunicacionId: { not: null } }, { documentoArchivoId: { not: null } }] },
            { asignadoPorId: usuarioId, OR: [{ comunicacionId: { not: null } }, { documentoArchivoId: { not: null } }] },
            { comunicacion: { radicadoPorId: usuarioId } },
            { documentoArchivo: { subidoPorId: usuarioId } },
          ],
    },
    orderBy: { completadoEn: "desc" },
    take: 100,
    include: {
      usuarioAsignado: { select: { nombre: true } },
      comunicacion: { select: { id: true, radicado: true, asunto: true } },
      documentoArchivo: { select: { nombre: true, expedienteDocumentalId: true, expediente: { select: { numero: true } } } },
    },
  });
  return solicitudes.flatMap((s) => {
    const base = { id: s.id, motivo: s.comentario ?? "", rechazadoPor: s.usuarioAsignado.nombre, fecha: s.completadoEn ?? s.asignadoEn };
    if (s.comunicacion) {
      return [{ ...base, titulo: s.comunicacion.asunto, referencia: `Radicado ${s.comunicacion.radicado}`, enlace: `/correspondencia/${s.comunicacion.id}` }];
    }
    if (s.documentoArchivo) {
      return [{
        ...base,
        titulo: s.documentoArchivo.nombre,
        referencia: `Expediente ${s.documentoArchivo.expediente.numero}`,
        enlace: `/correspondencia/expedientes/${s.documentoArchivo.expedienteDocumentalId}`,
      }];
    }
    return [];
  });
}

export async function listarMisFirmasSgdea(usuarioId: string) {
  return db.firma.findMany({
    where: { usuarioId, OR: [{ comunicacionId: { not: null } }, { documentoArchivoId: { not: null } }] },
    orderBy: { fechaHora: "desc" },
    take: 200,
    select: {
      id: true,
      fechaHora: true,
      hashContenido: true,
      calidad: true,
      comunicacion: { select: { id: true, radicado: true, asunto: true, tipo: true, documentos: { select: { id: true, mimeType: true }, take: 1, orderBy: { createdAt: "asc" } } } },
      documentoArchivo: { select: { id: true, nombre: true, mimeType: true, expedienteDocumentalId: true, expediente: { select: { numero: true } } } },
    },
  });
}
