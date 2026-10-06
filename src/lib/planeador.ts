import type { EstadoExpediente } from "@prisma/client";
import { ESTADOS_TERMINALES_EXPEDIENTE } from "@/lib/estados-expediente";

const ZONA_HORARIA = "America/Bogota";
const DESFASE_COLOMBIA = "-05:00";

export const ETIQUETA_ESTADO_VISITA: Record<string, string> = {
  PROGRAMADA: "Programada",
  REALIZADA: "Realizada",
  NO_REALIZADA: "No realizada",
  CANCELADA: "Cancelada",
};

export const CLASE_ESTADO_VISITA: Record<string, string> = {
  PROGRAMADA: "bg-sky-50 text-sky-700",
  REALIZADA: "bg-emerald-50 text-emerald-700",
  NO_REALIZADA: "bg-amber-50 text-amber-800",
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

export function claveMes(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

export function desplazarMes(anio: number, mes: number, delta: number): { anio: number; mes: number } {
  const total = anio * 12 + (mes - 1) + delta;
  return { anio: Math.floor(total / 12), mes: (total % 12) + 1 };
}

export type VistaCalendario = "dia" | "laboral" | "semana" | "mes" | "agenda";
export const VISTAS_CALENDARIO: { id: VistaCalendario; etiqueta: string }[] = [
  { id: "dia", etiqueta: "Día" },
  { id: "laboral", etiqueta: "Semana laboral" },
  { id: "semana", etiqueta: "Semana" },
  { id: "mes", etiqueta: "Mes" },
  { id: "agenda", etiqueta: "Agenda" },
];

export function vistaValida(v: string | undefined): VistaCalendario {
  return VISTAS_CALENDARIO.some((x) => x.id === v) ? (v as VistaCalendario) : "semana";
}

export function fechaValida(f: string | undefined, hoy: string): string {
  if (f && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(`${f}T00:00:00Z`))) return f;
  return hoy;
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diaSemanaLunes(fecha: string): number {
  return (new Date(`${fecha}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function lunesDe(fecha: string): string {
  return sumarDias(fecha, -diaSemanaLunes(fecha));
}

export function sumarMeses(fecha: string, meses: number): string {
  const { anio, mes } = desplazarMes(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)), meses);
  const dia = Math.min(Number(fecha.slice(8, 10)), new Date(Date.UTC(anio, mes, 0)).getUTCDate());
  return `${claveMes(anio, mes)}-${String(dia).padStart(2, "0")}`;
}

export function diasDeVista(vista: VistaCalendario, fecha: string): string[] {
  if (vista === "dia") return [fecha];
  if (vista === "laboral" || vista === "semana") {
    const lunes = lunesDe(fecha);
    return Array.from({ length: vista === "laboral" ? 5 : 7 }, (_, i) => sumarDias(lunes, i));
  }
  if (vista === "agenda") return Array.from({ length: 14 }, (_, i) => sumarDias(fecha, i));
  const primero = `${fecha.slice(0, 7)}-01`;
  const inicio = lunesDe(primero);
  const ultimo = sumarDias(sumarMeses(primero, 1), -1);
  const fin = sumarDias(lunesDe(ultimo), 6);
  const dias: string[] = [];
  for (let d = inicio; d <= fin; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

export function desplazarVista(vista: VistaCalendario, fecha: string, sentido: 1 | -1): string {
  if (vista === "dia") return sumarDias(fecha, sentido);
  if (vista === "mes") return sumarMeses(fecha, sentido);
  if (vista === "agenda") return sumarDias(fecha, 14 * sentido);
  return sumarDias(fecha, 7 * sentido);
}

export type BloqueUbicado<T> = { item: T; columna: number; columnas: number };

export const DURACION_VISITA_DEFECTO_MIN = 60;

export function ubicarBloques<T extends { minutos: number; duracion: number }>(items: T[]): BloqueUbicado<T>[] {
  const orden = [...items].sort((a, b) => a.minutos - b.minutos || b.duracion - a.duracion);
  const resultado: BloqueUbicado<T>[] = [];
  let grupo: BloqueUbicado<T>[] = [];
  let finGrupo = -Infinity;
  const cerrar = () => {
    const columnas = Math.max(1, ...grupo.map((g) => g.columna + 1));
    for (const g of grupo) resultado.push({ ...g, columnas });
    grupo = [];
  };
  for (const item of orden) {
    if (item.minutos >= finGrupo && grupo.length) cerrar();
    const ocupadas = new Set(grupo.filter((g) => g.item.minutos + g.item.duracion > item.minutos).map((g) => g.columna));
    let columna = 0;
    while (ocupadas.has(columna)) columna++;
    grupo.push({ item, columna, columnas: 1 });
    finGrupo = Math.max(finGrupo, item.minutos + item.duracion);
  }
  if (grupo.length) cerrar();
  return resultado;
}

export function finEfectivo(v: { fechaHora: Date; fechaHoraFin: Date | null }): Date {
  return v.fechaHoraFin ?? new Date(v.fechaHora.getTime() + DURACION_VISITA_DEFECTO_MIN * 60_000);
}

export function intervalosSeCruzan(a: { inicio: Date; fin: Date }, b: { inicio: Date; fin: Date }): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}

export function sumarMinutosHora(hora: string, minutos: number): string {
  const total = Math.min(23 * 60 + 59, Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5)) + minutos);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function normalizarBusqueda(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function filtrarExpedientes<T extends { numero: string; tramite: string; solicitante: string; identificacion: string; municipio: string; otrosIdentificadores: string[] }>(
  expedientes: T[],
  consulta: string
): T[] {
  const terminos = normalizarBusqueda(consulta).split(/\s+/).filter(Boolean);
  if (terminos.length === 0) return expedientes;
  return expedientes.filter((e) => {
    const texto = normalizarBusqueda([e.numero, e.tramite, e.solicitante, e.identificacion, e.municipio, ...e.otrosIdentificadores].join(" "));
    const compacto = texto.replace(/[\s.\-_/]/g, "");
    return terminos.every((t) => texto.includes(t) || compacto.includes(t.replace(/[.\-_/]/g, "")));
  });
}

export function lugarSugerido(e: { predioDireccion: string | null; predioNombre: string | null; municipio: string }): string {
  return [e.predioNombre, e.predioDireccion, e.municipio].filter((x) => x && x.trim()).join(", ");
}
