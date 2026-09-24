import type { EstadoSolicitudFirma } from "@prisma/client";

export type SolicitudParaEstado = {
  estado: EstadoSolicitudFirma;
  asignadoEn: Date;
  completadoEn: Date | null;
};

export function solicitudesVigentes<T extends SolicitudParaEstado>(solicitudes: T[]): T[] {
  return solicitudes.filter((s) => {
    if (s.estado !== "RECHAZADA") return true;
    const rechazadoEn = s.completadoEn ?? s.asignadoEn;
    return !solicitudes.some((otra) => otra !== s && otra.asignadoEn > rechazadoEn);
  });
}

export function estadoPorFirmas(solicitudesFirma: SolicitudParaEstado[]): "APROBADO" | "RECHAZADO" | "PENDIENTE" {
  if (solicitudesFirma.length === 0) return "APROBADO";
  const vigentes = solicitudesVigentes(solicitudesFirma);
  if (vigentes.some((s) => s.estado === "RECHAZADA")) return "RECHAZADO";
  if (vigentes.every((s) => s.estado === "COMPLETADA")) return "APROBADO";
  return "PENDIENTE";
}
