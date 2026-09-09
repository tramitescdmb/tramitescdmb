import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import type { CalendarioLaboral } from "@/lib/dias-habiles";

export const CALENDARIO_LABORAL_TAG = "calendario-laboral";

const cargar = unstable_cache(
  async (): Promise<{ diasNoLaborables: string[]; diasSemana: number[] }> => {
    const [dias, config] = await Promise.all([
      db.diaNoLaborado.findMany({ where: { activo: true }, select: { fecha: true } }),
      getConfiguracionSitio(),
    ]);
    return {
      diasNoLaborables: dias.map((d) => d.fecha.toISOString().slice(0, 10)),
      diasSemana: [...config.jornadaDiasSemana],
    };
  },
  ["calendario-laboral"],
  { tags: [CALENDARIO_LABORAL_TAG] }
);

/**
 * Calendario laboral vigente de la entidad: días compensados / cierres
 * institucionales (además de los festivos de ley, que se calculan solos) y qué
 * días de la semana se laboran. Alimenta el cálculo de términos de ley y las
 * métricas de tiempo del SGDEA. Cacheado; se invalida al editar la jornada o los
 * días no laborados (revalidateTag(CALENDARIO_LABORAL_TAG)).
 */
export async function getCalendarioLaboral(): Promise<CalendarioLaboral> {
  const { diasNoLaborables, diasSemana } = await cargar();
  return { diasNoLaborables: new Set(diasNoLaborables), diasSemana };
}

/** Todos los días no laborados configurados (para la pantalla de administración), próximos primero. */
export async function listarDiasNoLaborados() {
  return db.diaNoLaborado.findMany({ orderBy: { fecha: "desc" } });
}

export async function crearDiaNoLaborado(fechaIso: string, motivo: string) {
  const m = motivo.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIso)) throw new Error("La fecha no es válida.");
  if (!m) throw new Error("Indique el motivo (ej. día compensado, cierre institucional).");
  const fecha = new Date(`${fechaIso}T00:00:00.000Z`);
  const existe = await db.diaNoLaborado.findUnique({ where: { fecha } });
  if (existe) throw new Error(`Ya hay un día no laborado registrado para el ${fechaIso}.`);
  return db.diaNoLaborado.create({ data: { fecha, motivo: m } });
}

export async function cambiarEstadoDiaNoLaborado(id: string, activo: boolean) {
  return db.diaNoLaborado.update({ where: { id }, data: { activo } });
}

export async function eliminarDiaNoLaborado(id: string) {
  return db.diaNoLaborado.delete({ where: { id } });
}

const DIAS_SEMANA_VALIDOS = [0, 1, 2, 3, 4, 5, 6];

export async function actualizarJornada(datos: { diasSemana: number[]; horaInicio: string; horaFin: string }) {
  const dias = Array.from(new Set(datos.diasSemana)).filter((d) => DIAS_SEMANA_VALIDOS.includes(d)).sort();
  if (dias.length === 0) throw new Error("La jornada debe tener al menos un día laborable.");
  const hora = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!hora.test(datos.horaInicio) || !hora.test(datos.horaFin)) throw new Error("Las horas deben tener el formato HH:MM.");
  if (datos.horaInicio >= datos.horaFin) throw new Error("La hora de inicio debe ser anterior a la de fin.");
  return db.configuracionSitio.update({
    where: { id: "singleton" },
    data: { jornadaDiasSemana: dias, jornadaHoraInicio: datos.horaInicio, jornadaHoraFin: datos.horaFin },
  });
}

export const ETIQUETA_DIA_SEMANA: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  0: "Domingo",
};
export const ORDEN_DIAS_SEMANA = [1, 2, 3, 4, 5, 6, 0];
