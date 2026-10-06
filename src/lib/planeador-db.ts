import { db } from "@/lib/db";
import { VENTANA_CRUCE_MIN, fechaHoraColombia, horaCorta } from "@/lib/planeador";
import { formatearFecha } from "@/lib/fecha";

export async function buscarCruceVisita(profesionalId: string, fechaHora: Date, excluirId?: string): Promise<string | null> {
  const margen = VENTANA_CRUCE_MIN * 60 * 1000;
  const otra = await db.visitaProgramada.findFirst({
    where: {
      profesionalId,
      estado: "PROGRAMADA",
      fechaHora: { gt: new Date(fechaHora.getTime() - margen), lt: new Date(fechaHora.getTime() + margen) },
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
    orderBy: { fechaHora: "asc" },
    select: { fechaHora: true, lugar: true, expediente: { select: { numero: true } }, profesional: { select: { nombre: true } } },
  });
  if (!otra) return null;
  return `${otra.profesional.nombre} ya tiene una visita el ${formatearFecha(otra.fechaHora)} a las ${horaCorta(otra.fechaHora)} (expediente ${otra.expediente.numero}, ${otra.lugar}).`;
}

export type DatosVisita = { fechaHora: Date; lugar: string; profesionalId: string; observaciones: string | null };

export function leerDatosVisita(body: Record<string, unknown> | null): DatosVisita | string {
  const fecha = typeof body?.fecha === "string" ? body.fecha : "";
  const hora = typeof body?.hora === "string" ? body.hora : "";
  const lugar = typeof body?.lugar === "string" ? body.lugar.trim() : "";
  const profesionalId = typeof body?.profesionalId === "string" ? body.profesionalId : "";
  const observaciones = typeof body?.observaciones === "string" && body.observaciones.trim() ? body.observaciones.trim() : null;
  const desdeFecha = fechaHoraColombia(fecha, hora);
  if (!desdeFecha) return "Indique una fecha y una hora válidas.";
  if (!lugar) return "Indique el lugar de la visita.";
  if (lugar.length > 300) return "El lugar admite hasta 300 caracteres.";
  if (!profesionalId) return "Seleccione el profesional o técnico que realizará la visita.";
  return { fechaHora: desdeFecha, lugar, profesionalId, observaciones };
}
