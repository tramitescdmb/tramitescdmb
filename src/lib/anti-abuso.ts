import { db } from "@/lib/db";

/**
 * Límite de envíos públicos sin autenticación (formulario PQRSD, Fase 3). No hay
 * proveedor de CAPTCHA en el proyecto (exigiría crear una cuenta/API key externa)
 * — este conteo por IP+ruta, combinado con el honeypot y el tiempo mínimo de
 * llenado que aplican las propias rutas públicas, es la defensa contra abuso.
 *
 * Persistido en base (`IntentoEnvioPublico`), no en memoria: en Vercel cada
 * invocación puede caer en una instancia distinta, así que un limitador en
 * memoria de proceso no serviría entre invocaciones sucesivas.
 */

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
  // Se cuenta el intento aunque la solicitud termine fallando más adelante
  // (datos inválidos, etc.) — el límite es sobre solicitudes, no solo éxitos.
  await db.intentoEnvioPublico.create({ data: { ip: clave, ruta } });
  return { permitido: true };
}

export const MIN_MS_LLENADO_FORMULARIO = 3000;

/** Heurística anti-bot: un envío casi instantáneo tras cargar el formulario suele ser un bot. */
export function llenadoDemasiadoRapido(tsCargaFormulario: number): boolean {
  return Date.now() - tsCargaFormulario < MIN_MS_LLENADO_FORMULARIO;
}
