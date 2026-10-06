import type { EstadoExpediente } from "@prisma/client";
import { ESTADOS_TERMINALES_EXPEDIENTE } from "@/lib/estados-expediente";

const ZONA_HORARIA = "America/Bogota";
const DESFASE_COLOMBIA = "-05:00";
export const VENTANA_CRUCE_MIN = 90;

export const ETIQUETA_ESTADO_VISITA: Record<string, string> = {
  PROGRAMADA: "Programada",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada",
};

export const CLASE_ESTADO_VISITA: Record<string, string> = {
  PROGRAMADA: "bg-sky-50 text-sky-700",
  REALIZADA: "bg-emerald-50 text-emerald-700",
  CANCELADA: "bg-stone-100 text-stone-500 line-through",
};

export function expedienteEnEjecucion(e: { estado: EstadoExpediente | string; archivado: boolean }): boolean {
  return !e.archivado && !(ESTADOS_TERMINALES_EXPEDIENTE as readonly string[]).includes(e.estado);
}

export function fechaHoraColombia(fecha: string, hora: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  const d = new Date(`${fecha}T${hora}:00${DESFASE_COLOMBIA}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function partesColombia(d: Date): { fecha: string; hora: string } {
  const fecha = d.toLocaleDateString("en-CA", { timeZone: ZONA_HORARIA });
  const hora = d.toLocaleTimeString("en-GB", { timeZone: ZONA_HORARIA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return { fecha, hora };
}

export function horaCorta(d: Date): string {
  return d.toLocaleTimeString("es-CO", { timeZone: ZONA_HORARIA, hour: "numeric", minute: "2-digit" });
}

export function mesValido(mes: string | undefined, hoy: Date = new Date()): { anio: number; mes: number } {
  const m = mes && /^(\d{4})-(\d{2})$/.exec(mes);
  if (m) {
    const anio = Number(m[1]);
    const mm = Number(m[2]);
    if (anio >= 2000 && anio <= 2100 && mm >= 1 && mm <= 12) return { anio, mes: mm };
  }
  const { fecha } = partesColombia(hoy);
  return { anio: Number(fecha.slice(0, 4)), mes: Number(fecha.slice(5, 7)) };
}

export function claveMes(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

export function desplazarMes(anio: number, mes: number, delta: number): { anio: number; mes: number } {
  const total = anio * 12 + (mes - 1) + delta;
  return { anio: Math.floor(total / 12), mes: (total % 12) + 1 };
}

export function rangoMes(anio: number, mes: number): { desde: Date; hasta: Date } {
  const sig = desplazarMes(anio, mes, 1);
  return {
    desde: fechaHoraColombia(`${claveMes(anio, mes)}-01`, "00:00")!,
    hasta: fechaHoraColombia(`${claveMes(sig.anio, sig.mes)}-01`, "00:00")!,
  };
}

export function semanasDelMes(anio: number, mes: number): (string | null)[][] {
  const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const primerDiaSemana = (new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay() + 6) % 7;
  const celdas: (string | null)[] = Array.from({ length: primerDiaSemana }, () => null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(`${claveMes(anio, mes)}-${String(d).padStart(2, "0")}`);
  while (celdas.length % 7 !== 0) celdas.push(null);
  const semanas: (string | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}

export function lugarSugerido(e: { predioDireccion: string | null; predioNombre: string | null; municipio: string }): string {
  return [e.predioNombre, e.predioDireccion, e.municipio].filter((x) => x && x.trim()).join(", ");
}
