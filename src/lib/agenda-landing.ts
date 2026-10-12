import { db } from "@/lib/db";
import { fechaHoraColombia, finEfectivo, lunesDe, partesColombia, sumarDias } from "@/lib/planeador";

export type VisitaAgenda = {
  id: string;
  dia: string;
  hora: string;
  horaFin: string;
  estado: string;
  lugar: string;
  numero: string;
  tramite: string;
  municipio: string;
  link: string;
};

export type AgendaLanding = { hoy: string; desde: string; hasta: string; visitas: VisitaAgenda[] };

const SEMANAS_ATRAS = 1;
const SEMANAS_ADELANTE = 5;

export async function obtenerAgendaUsuario(userId: string, planificador: boolean): Promise<AgendaLanding | null> {
  const hoy = partesColombia(new Date()).fecha;
  const desde = sumarDias(lunesDe(hoy), -7 * SEMANAS_ATRAS);
  const hasta = sumarDias(lunesDe(hoy), 7 * SEMANAS_ADELANTE);

  const visitas = await db.visitaProgramada.findMany({
    where: {
      profesionalId: userId,
      estado: { not: "CANCELADA" },
      fechaHora: { gte: fechaHoraColombia(desde, "00:00")!, lt: fechaHoraColombia(hasta, "00:00")! },
    },
    orderBy: { fechaHora: "asc" },
    select: {
      id: true,
      fechaHora: true,
      fechaHoraFin: true,
      estado: true,
      lugar: true,
      visitaTecnica: { select: { id: true } },
      expediente: { select: { id: true, numero: true, municipio: true, tramiteTipo: { select: { nombre: true } } } },
    },
  });

  if (visitas.length === 0 && !planificador) return null;

  return {
    hoy,
    desde,
    hasta: sumarDias(hasta, -1),
    visitas: visitas.map((v) => {
      const { fecha: dia, hora } = partesColombia(v.fechaHora);
      return {
        id: v.id,
        dia,
        hora,
        horaFin: partesColombia(finEfectivo(v)).hora,
        estado: v.estado,
        lugar: v.lugar,
        numero: v.expediente.numero,
        tramite: v.expediente.tramiteTipo.nombre,
        municipio: v.expediente.municipio,
        link: v.visitaTecnica ? `/expedientes/${v.expediente.id}/visitas/${v.visitaTecnica.id}` : `/planeador?vista=dia&fecha=${dia}`,
      };
    }),
  };
}
