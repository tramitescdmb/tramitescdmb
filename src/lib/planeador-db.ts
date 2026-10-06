import { db } from "@/lib/db";
import { fechaHoraColombia, finEfectivo, horaCorta, intervalosSeCruzan } from "@/lib/planeador";
import { formatearFecha } from "@/lib/fecha";
import { TEMAS_VISITA_BASE } from "@/lib/temas-visita";

export async function buscarCruceVisita(profesionalId: string, inicio: Date, fin: Date, excluirId?: string): Promise<string | null> {
  const candidatas = await db.visitaProgramada.findMany({
    where: {
      profesionalId,
      estado: "PROGRAMADA",
      fechaHora: { gt: new Date(inicio.getTime() - 24 * 60 * 60 * 1000), lt: fin },
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
    orderBy: { fechaHora: "asc" },
    select: { fechaHora: true, fechaHoraFin: true, lugar: true, expediente: { select: { numero: true } }, profesional: { select: { nombre: true } } },
  });
  const otra = candidatas.find((c) => intervalosSeCruzan({ inicio, fin }, { inicio: c.fechaHora, fin: finEfectivo(c) }));
  if (!otra) return null;
  return `${otra.profesional.nombre} ya tiene una visita el ${formatearFecha(otra.fechaHora)} de ${horaCorta(otra.fechaHora)} a ${horaCorta(finEfectivo(otra))} (expediente ${otra.expediente.numero}, ${otra.lugar}).`;
}

export type DatosVisita = { fechaHora: Date; fechaHoraFin: Date; lugar: string; profesionalId: string; observaciones: string | null };

export function leerDatosVisita(body: Record<string, unknown> | null): DatosVisita | string {
  const fecha = typeof body?.fecha === "string" ? body.fecha : "";
  const hora = typeof body?.hora === "string" ? body.hora : "";
  const horaFin = typeof body?.horaFin === "string" ? body.horaFin : "";
  const lugar = typeof body?.lugar === "string" ? body.lugar.trim() : "";
  const profesionalId = typeof body?.profesionalId === "string" ? body.profesionalId : "";
  const observaciones = typeof body?.observaciones === "string" && body.observaciones.trim() ? body.observaciones.trim() : null;
  const inicio = fechaHoraColombia(fecha, hora);
  const fin = fechaHoraColombia(fecha, horaFin);
  if (!inicio) return "Indique una fecha y una hora de inicio válidas.";
  if (!fin) return "Indique la hora de finalización de la visita.";
  if (fin <= inicio) return "La hora de finalización debe ser posterior a la de inicio.";
  if (!lugar) return "Indique el lugar de la visita.";
  if (lugar.length > 300) return "El lugar admite hasta 300 caracteres.";
  if (!profesionalId) return "Seleccione el profesional o técnico que realizará la visita.";
  return { fechaHora: inicio, fechaHoraFin: fin, lugar, profesionalId, observaciones };
}

export async function temasDeVisita() {
  const existentes = await db.temaVisita.count({ where: { base: true } });
  if (existentes < TEMAS_VISITA_BASE.length) {
    await db.temaVisita.createMany({
      data: TEMAS_VISITA_BASE.map((t) => ({ nombre: t.nombre, codigosTramite: t.codigos, base: true })),
      skipDuplicates: true,
    });
  }
  return db.temaVisita.findMany({ where: { activo: true }, select: { id: true, nombre: true, codigosTramite: true, base: true }, orderBy: { nombre: "asc" } });
}

export function rangoTexto(inicio: Date, fin: Date | null): string {
  return `${formatearFecha(inicio)} de ${horaCorta(inicio)} a ${horaCorta(finEfectivo({ fechaHora: inicio, fechaHoraFin: fin }))}`;
}
