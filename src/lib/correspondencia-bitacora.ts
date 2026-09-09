import { db } from "@/lib/db";
import type { AccionAuditoriaDoc } from "@prisma/client";
import { parsearFechaLocal } from "@/lib/periodo-dashboard";

export const ACCIONES_BITACORA: AccionAuditoriaDoc[] = [
  "CREA", "LEE", "MODIFICA", "EXPORTA", "ELIMINA", "DISTRIBUYE", "FIRMA",
  "CLASIFICA", "ARCHIVA", "ANULA", "SUSPENDE", "REACTIVA", "TRANSFIERE", "DISPONE", "ACCESO_DENEGADO",
  "APLAZA", "RESPONDE", "PRESTA", "DEVUELVE", "REABRE", "CARGA_FALLIDA", "ERROR_EJECUCION", "FLUJO",
];

export const ETIQUETA_ACCION_BITACORA: Record<string, string> = {
  CREA: "Creación", LEE: "Consulta", MODIFICA: "Modificación", EXPORTA: "Exportación",
  ELIMINA: "Eliminación", DISTRIBUYE: "Distribución", FIRMA: "Firma", CLASIFICA: "Clasificación",
  ARCHIVA: "Archivo", ANULA: "Anulación", SUSPENDE: "Suspensión de término", REACTIVA: "Reactivación de término",
  TRANSFIERE: "Transferencia a archivo central", DISPONE: "Disposición final", ACCESO_DENEGADO: "Acceso denegado",
  APLAZA: "Aplazamiento de disposición", RESPONDE: "Respuesta de funcionario", PRESTA: "Préstamo", DEVUELVE: "Devolución",
  REABRE: "Reapertura", CARGA_FALLIDA: "Cargue rechazado", ERROR_EJECUCION: "Error de ejecución",
  FLUJO: "Flujo de trabajo",
};

export type FiltrosBitacora = { accion?: AccionAuditoriaDoc; entidad?: string; desde?: string; hasta?: string };

/** Where compartido entre el listado paginado y la exportación — mismos filtros en los dos. Un
 * "desde"/"hasta" mal formado (URL editada a mano, enlace viejo) se ignora en vez de reventar la consulta
 * — Prisma no acepta un Date inválido como valor de filtro. */
export function construirWhereBitacora(filtros: FiltrosBitacora) {
  const desde = filtros.desde ? parsearFechaLocal(filtros.desde) : null;
  const hasta = filtros.hasta ? parsearFechaLocal(filtros.hasta) : null;
  return {
    ...(filtros.accion ? { accion: filtros.accion } : {}),
    ...(filtros.entidad ? { entidad: filtros.entidad } : {}),
    ...(desde || hasta
      ? {
          createdAt: {
            ...(desde ? { gte: desde } : {}),
            ...(hasta ? { lte: new Date(hasta.getTime() + 86_400_000 - 1) } : {}),
          },
        }
      : {}),
  };
}

/**
 * Bitácora inalterable con filtros (MoReq 6.14) — paginada, más reciente primero.
 * Vive en su propia página (no dentro del Panel): crece indefinidamente y no debe
 * competir por tiempo de carga con las gráficas del panel de reportes.
 */
export async function listarBitacoraFiltrada(filtros: FiltrosBitacora, pagina: number, porPagina = 30) {
  const where = construirWhereBitacora(filtros);

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
