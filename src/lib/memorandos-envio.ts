import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sumarDiasHabiles } from "@/lib/dias-habiles";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { registrarAuditoriaDoc } from "@/lib/auditoria-doc";

/**
 * Entrega de un memorando que lleva firmas de quien proyectó o revisó.
 *
 * Mientras falte alguna de esas firmas (o alguna fue rechazada), el memorando queda retenido: solo
 * lo ven quien lo envió, quienes deben firmarlo (bandeja «Por firmar») y la oficina de origen. A los
 * destinatarios (persona, dependencia o envío masivo) no les llega nada. Con la última firma se libera
 * solo: les aparece en «Recibidos» / «Sin leer» y, si pide respuesta, el plazo empieza a contar ahí.
 *
 * La retención se deduce de las solicitudes de firma, no de una marca aparte: un memorando está
 * entregado exactamente cuando no tiene firmas de proyectó / revisó pendientes ni rechazadas.
 */
export const CALIDADES_COFIRMA_MEMORANDO = ["PROYECTO", "REVISO"] as const;

export const FIRMA_QUE_RETIENE: Prisma.SolicitudFirmaWhereInput = {
  rol: "FIRMA",
  calidad: { in: [...CALIDADES_COFIRMA_MEMORANDO] },
  estado: { in: ["PENDIENTE", "RECHAZADA"] },
};

/** El memorando todavía espera firmas de proyectó / revisó (o alguna se rechazó): no se ha entregado. */
export const WHERE_MEMORANDO_EN_FIRMA: Prisma.ComunicacionWhereInput = { solicitudesFirma: { some: FIRMA_QUE_RETIENE } };

/** El memorando ya se entregó a sus destinatarios (no tiene firmas de proyectó / revisó por resolver). */
export const WHERE_MEMORANDO_ENTREGADO: Prisma.ComunicacionWhereInput = { solicitudesFirma: { none: FIRMA_QUE_RETIENE } };

export type EstadoEnvioMemorando = { retenido: boolean; plazoRespuestaDias: number | null; liberadoEn: string | null };

export function leerEnvioMemorando(datos: unknown): EstadoEnvioMemorando | null {
  if (!datos || typeof datos !== "object") return null;
  const e = (datos as Record<string, unknown>).envio;
  if (!e || typeof e !== "object") return null;
  const o = e as Record<string, unknown>;
  const plazo = Math.floor(Number(o.plazoRespuestaDias) || 0);
  return {
    retenido: o.retenido === true,
    plazoRespuestaDias: plazo > 0 ? plazo : null,
    liberadoEn: typeof o.liberadoEn === "string" ? o.liberadoEn : null,
  };
}

/**
 * Si el memorando estaba retenido y ya no le falta ninguna firma, lo entrega: fija el plazo de
 * respuesta desde hoy, pone la fecha de entrega de cada destinatario y deja constancia. Es seguro
 * llamarla varias veces (solo actúa una vez). Devuelve true si lo liberó en esta llamada.
 */
export async function liberarMemorandoSiFirmado(comunicacionId: string, usuarioId: string | null): Promise<boolean> {
  const calendario = await getCalendarioLaboral();
  const liberado = await db.$transaction(async (tx) => {
    // Bloquea la fila: dos firmas que terminan al mismo tiempo no liberan dos veces.
    await tx.$queryRaw`SELECT id FROM "Comunicacion" WHERE id = ${comunicacionId} FOR UPDATE`;
    const c = await tx.comunicacion.findUnique({
      where: { id: comunicacionId },
      select: {
        tipo: true,
        estado: true,
        radicado: true,
        respondeAId: true,
        datosMemorando: true,
        _count: { select: { solicitudesFirma: { where: FIRMA_QUE_RETIENE }, distribuciones: { where: { activa: true } } } },
      },
    });
    if (!c || c.tipo !== "INTERNA" || c.estado === "ANULADA") return null;
    const envio = leerEnvioMemorando(c.datosMemorando);
    if (!envio?.retenido || envio.liberadoEn || c._count.solicitudesFirma > 0) return null;

    const ahora = new Date();
    const plazo = envio.plazoRespuestaDias;
    await tx.comunicacion.update({
      where: { id: comunicacionId },
      data: {
        datosMemorando: { ...(c.datosMemorando as Record<string, unknown>), envio: { ...envio, liberadoEn: ahora.toISOString() } } as Prisma.InputJsonValue,
        ...(plazo ? { fechaVencimiento: sumarDiasHabiles(ahora, plazo, calendario) } : {}),
      },
    });
    await tx.distribucion.updateMany({ where: { comunicacionId, activa: true, fechaAcuse: null }, data: { fechaAsignacion: ahora } });
    // Si es la respuesta a otro memorando, ese queda respondido ahora (no al enviarlo a firmas).
    if (c.respondeAId) {
      await tx.comunicacion.updateMany({ where: { id: c.respondeAId, estado: { notIn: ["ANULADA", "ARCHIVADA"] } }, data: { estado: "RESPONDIDA" } });
    }
    return { radicado: c.radicado, entregas: c._count.distribuciones, plazo };
  });
  if (!liberado) return false;
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: comunicacionId,
    accion: "DISTRIBUYE",
    usuarioId,
    ip: null,
    userAgent: null,
    detalle: `Con la última firma se entregó el memorando ${liberado.radicado} a sus destinatarios (${liberado.entregas} entrega${liberado.entregas === 1 ? "" : "s"})${liberado.plazo ? `; plazo de respuesta de ${liberado.plazo} días hábiles desde hoy` : ""}.`,
  }).catch((e) => console.error("registrarAuditoriaDoc (liberarMemorandoSiFirmado) falló:", e));
  return true;
}
