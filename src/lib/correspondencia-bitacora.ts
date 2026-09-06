import { db } from "@/lib/db";
import type { AccionAuditoriaDoc } from "@prisma/client";

export const ACCIONES_BITACORA: AccionAuditoriaDoc[] = [
  "CREA", "LEE", "MODIFICA", "EXPORTA", "ELIMINA", "DISTRIBUYE", "FIRMA",
  "CLASIFICA", "ARCHIVA", "ANULA", "SUSPENDE", "REACTIVA", "TRANSFIERE", "DISPONE", "ACCESO_DENEGADO",
];

export const ETIQUETA_ACCION_BITACORA: Record<string, string> = {
  CREA: "Creación", LEE: "Consulta", MODIFICA: "Modificación", EXPORTA: "Exportación",
  ELIMINA: "Eliminación", DISTRIBUYE: "Distribución", FIRMA: "Firma", CLASIFICA: "Clasificación",
  ARCHIVA: "Archivo", ANULA: "Anulación", SUSPENDE: "Suspensión de término", REACTIVA: "Reactivación de término",
  TRANSFIERE: "Transferencia a archivo central", DISPONE: "Disposición final", ACCESO_DENEGADO: "Acceso denegado",
};

export type FiltrosBitacora = { accion?: AccionAuditoriaDoc; entidad?: string; desde?: string; hasta?: string };

/**
 * Bitácora inalterable con filtros (MoReq 6.14) — paginada, más reciente primero.
 * Vive en su propia página (no en Reportes): crece indefinidamente y no debe
 * competir por tiempo de carga con las gráficas del panel de reportes.
 */
export async function listarBitacoraFiltrada(filtros: FiltrosBitacora, pagina: number, porPagina = 30) {
  const where = {
    ...(filtros.accion ? { accion: filtros.accion } : {}),
    ...(filtros.entidad ? { entidad: filtros.entidad } : {}),
    ...(filtros.desde || filtros.hasta
      ? {
          createdAt: {
            ...(filtros.desde ? { gte: new Date(filtros.desde) } : {}),
            ...(filtros.hasta ? { lte: new Date(`${filtros.hasta}T23:59:59`) } : {}),
          },
        }
      : {}),
  };

  const [total, filas, entidades] = await Promise.all([
    db.auditoriaDoc.count({ where }),
    db.auditoriaDoc.findMany({
      where,
      orderBy: { secuencia: "desc" },
      skip: Math.max(0, pagina - 1) * porPagina,
      take: porPagina,
      include: { usuario: { select: { nombre: true } } },
    }),
    db.auditoriaDoc.findMany({ distinct: ["entidad"], select: { entidad: true } }),
  ]);

  return { total, filas, entidadesDisponibles: entidades.map((e) => e.entidad).sort(), totalPaginas: Math.max(1, Math.ceil(total / porPagina)) };
}
