import type { OrigenExpedienteDocumental } from "@prisma/client";
import { db } from "@/lib/db";
import { puedeAccederCorrespondencia, puedeVerNivelAccesoExpediente, type PermisosUsuario } from "@/lib/permisos";
import { datosPeticion, registrarAuditoriaDoc } from "@/lib/auditoria-doc";

export async function accesoDesdeArchivoSgdea(opciones: {
  permisos: PermisosUsuario;
  origen: Exclude<OrigenExpedienteDocumental, "SGDEA">;
  origenId: string;
  usuarioId: string;
  documento: string;
  headers: Headers;
}): Promise<boolean> {
  const { permisos, origen, origenId, usuarioId, documento, headers } = opciones;
  if (!puedeAccederCorrespondencia(permisos)) return false;
  const ficha = await db.expedienteDocumental.findUnique({
    where: { origenId },
    select: { id: true, origen: true, nivelAcceso: true, dependenciaId: true },
  });
  if (!ficha || ficha.origen !== origen || !puedeVerNivelAccesoExpediente(permisos, ficha)) return false;
  const { ip, userAgent } = datosPeticion(headers);
  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumental",
    entidadId: ficha.id,
    accion: "LEE",
    usuarioId,
    ip,
    userAgent,
    detalle: `Consultó "${documento}" desde el archivo del SGDEA`,
  });
  return true;
}
