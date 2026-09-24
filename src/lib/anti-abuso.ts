import { db } from "@/lib/db";

const VENTANA_HORA_MS = 60 * 60 * 1000;
const VENTANA_DIA_MS = 24 * VENTANA_HORA_MS;

export type ResultadoLimite = { permitido: boolean; motivo?: string };

export async function verificarLimiteEnvio(
  ip: string | null,
  ruta: string,
  limites: { porHora: number; porDia: number } = { porHora: 5, porDia: 20 }
): Promise<ResultadoLimite> {
  const clave = ip || "sin-ip";
  const ahora = new Date();
  const [enUltimaHora, enUltimoDia] = await Promise.all([
    db.intentoEnvioPublico.count({ where: { ip: clave, ruta, createdAt: { gte: new Date(ahora.getTime() - VENTANA_HORA_MS) } } }),
    db.intentoEnvioPublico.count({ where: { ip: clave, ruta, createdAt: { gte: new Date(ahora.getTime() - VENTANA_DIA_MS) } } }),
  ]);
  if (enUltimaHora >= limites.porHora) {
    return { permitido: false, motivo: "Demasiadas solicitudes desde esta conexión en la última hora. Intente más tarde." };
  }
  if (enUltimoDia >= limites.porDia) {
    return { permitido: false, motivo: "Se alcanzó el máximo de solicitudes diarias desde esta conexión. Intente mañana." };
  }
  await db.intentoEnvioPublico.create({ data: { ip: clave, ruta } });
  return { permitido: true };
}

export const MIN_MS_LLENADO_FORMULARIO = 3000;

export function llenadoDemasiadoRapido(tsCargaFormulario: number): boolean {
  return Date.now() - tsCargaFormulario < MIN_MS_LLENADO_FORMULARIO;
}
