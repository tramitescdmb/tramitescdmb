import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { puedeGestionarArchivo, type PermisosUsuario } from "@/lib/permisos";

/**
 * Comunicaciones clasificadas o reservadas (Ley 1712 de 2014): además de las públicas, cada quien ve
 * solo las que le fueron asignadas (reparto a su nombre, o a su dependencia sin persona), las que radicó,
 * proyectó como respuesta o debe firmar. Gestión documental (quien administra el archivo) y el
 * administrador ven todas. Devuelve null cuando no hay que filtrar.
 */
export function filtroNivelAccesoComunicacion(permisos: PermisosUsuario, usuarioId: string): Prisma.ComunicacionWhereInput | null {
  if (permisos.esAdmin || puedeGestionarArchivo(permisos)) return null;
  const asignada: Prisma.DistribucionWhereInput[] = [{ usuarioId }];
  if (permisos.dependenciaId) asignada.push({ usuarioId: null, dependenciaId: permisos.dependenciaId });
  return {
    OR: [
      { nivelAcceso: "PUBLICA" },
      { distribuciones: { some: { OR: asignada } } },
      { radicadoPorId: usuarioId },
      { respuestaPorId: usuarioId },
      { solicitudesFirma: { some: { usuarioAsignadoId: usuarioId } } },
    ],
  };
}

export async function puedeVerComunicacion(permisos: PermisosUsuario, usuarioId: string, comunicacionId: string): Promise<boolean> {
  const filtro = filtroNivelAccesoComunicacion(permisos, usuarioId);
  if (!filtro) return true;
  return (await db.comunicacion.count({ where: { id: comunicacionId, AND: [filtro] } })) > 0;
}
