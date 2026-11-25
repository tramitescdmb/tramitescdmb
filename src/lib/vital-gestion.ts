import { db } from "@/lib/db";
import { notificar, resolverNotificaciones } from "@/lib/notificaciones";
import { nombreTramiteVital } from "@/lib/vital";
import { CARGO_SUBDIRECTOR_SEYCA } from "@/lib/permisos";

export const claveAvisoVital = (solicitudId: string) => `vital-nueva:${solicitudId}`;

/**
 * Quién recibe «Tiene una nueva solicitud de VITAL»: los mismos que pueden convertirla
 * en trámite — administradores y Subdirector(a) de Evaluación y Control Ambiental.
 */
export async function destinatariosSolicitudVital(): Promise<string[]> {
  const usuarios = await db.usuario.findMany({
    where: {
      activo: true,
      OR: [{ rol: "ADMIN" }, { cargoAsignaciones: { some: { cargo: { nombre: CARGO_SUBDIRECTOR_SEYCA } } } }],
    },
    select: { id: true },
  });
  return usuarios.map((u) => u.id);
}

export async function avisarSolicitudVitalNueva(s: {
  id: string;
  idVital: string;
  idTramiteVital: number;
  solicitanteNombre: string | null;
}): Promise<void> {
  const usuarios = await destinatariosSolicitudVital();
  await notificar(usuarios, {
    tipo: "VITAL_NUEVA",
    clave: claveAvisoVital(s.id),
    titulo: `Tiene una nueva solicitud de VITAL · ${s.idVital}`,
    mensaje: `${nombreTramiteVital(s.idTramiteVital)}${s.solicitanteNombre ? ` — ${s.solicitanteNombre}` : ""}. Revise si es procedente convertirla en trámite.`,
    enlace: `/vital/${s.id}`,
  });
}

export async function resolverAvisoSolicitudVital(solicitudId: string): Promise<void> {
  await resolverNotificaciones({ clave: claveAvisoVital(solicitudId) });
}

export async function contarSolicitudesVitalNuevas(): Promise<number> {
  return db.solicitudVital.count({ where: { gestion: "NUEVA" } });
}
