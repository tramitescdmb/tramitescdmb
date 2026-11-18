import { db } from "@/lib/db";
import { notificar, resolverNotificaciones } from "@/lib/notificaciones";
import { nombreTramiteVital } from "@/lib/vital";
import { codigoTramiteSugerido } from "@/lib/vital-conversion";

export const claveAvisoVital = (solicitudId: string) => `vital-nueva:${solicitudId}`;

/**
 * Quién recibe «Tiene una nueva solicitud de VITAL»: los administradores y quien
 * puede radicar (nivel EDITAR) el trámite de SIC que corresponde. Si el tipo de
 * VITAL no tiene trámite sugerido, quien puede radicar algún trámite y consulta VITAL.
 */
export async function destinatariosSolicitudVital(idTramiteVital: number): Promise<string[]> {
  const codigo = codigoTramiteSugerido(idTramiteVital);
  const tramite = codigo ? await db.tramiteTipo.findUnique({ where: { codigo }, select: { id: true } }) : null;
  const usuarios = await db.usuario.findMany({
    where: {
      activo: true,
      OR: [
        { rol: "ADMIN" },
        tramite
          ? { tramitesAcceso: { some: { tramiteTipoId: tramite.id, nivel: "EDITAR" } } }
          : { tramitesAcceso: { some: { nivel: "EDITAR" } }, seccionesAcceso: { some: { seccion: "VITAL_BASE" } } },
      ],
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
  const usuarios = await destinatariosSolicitudVital(s.idTramiteVital);
  await notificar(usuarios, {
    tipo: "VITAL_NUEVA",
    clave: claveAvisoVital(s.id),
    titulo: `Tiene una nueva solicitud de VITAL · ${s.idVital}`,
    mensaje: `${nombreTramiteVital(s.idTramiteVital)}${s.solicitanteNombre ? ` — ${s.solicitanteNombre}` : ""}. Revísela y conviértala en trámite.`,
    enlace: `/vital/${s.id}`,
  });
}

export async function resolverAvisoSolicitudVital(solicitudId: string): Promise<void> {
  await resolverNotificaciones({ clave: claveAvisoVital(solicitudId) });
}

export async function contarSolicitudesVitalNuevas(): Promise<number> {
  return db.solicitudVital.count({ where: { gestion: "NUEVA" } });
}
