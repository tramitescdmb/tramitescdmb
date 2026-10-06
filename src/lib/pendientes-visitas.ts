import { db } from "@/lib/db";
import { ESTADOS_TERMINALES_EXPEDIENTE } from "@/lib/estados-expediente";
import { finEfectivo, horaCorta, partesColombia, sumarDias } from "@/lib/planeador";
import { pasoPermiteVisita } from "@/lib/temas-visita";

export type VisitaAlerta = {
  id: string;
  expedienteId: string;
  numero: string;
  tramite: string;
  profesionalId: string;
  profesional: string;
  inicio: Date;
  fin: Date;
  estado: string;
  lugar: string;
};

export type ExpedienteAlerta = {
  id: string;
  numero: string;
  tramite: string;
  pasoActualNumero: number;
  pasoTitulo: string | null;
  pasoDescripcion?: string | null;
  visitas: { estado: string; inicio: Date }[];
  pasosConHoja: number[];
};

export type AlertaVisita = { expedienteId: string; visitaId?: string; numero: string; tramite: string; texto: string; destacada?: boolean };

export type ResumenVisitas = {
  proximas: AlertaVisita[];
  porRegistrar: AlertaVisita[];
  equipoVencidas: AlertaVisita[];
  porReprogramar: AlertaVisita[];
  sinProgramar: AlertaVisita[];
  hayAlgo: boolean;
};

const DIAS_PROXIMAS = 7;

export function etiquetaDia(dia: string, hoy: string): string {
  if (dia === hoy) return "Hoy";
  if (dia === sumarDias(hoy, 1)) return "Mañana";
  const texto = new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function cuando(v: VisitaAlerta, hoy: string) {
  return `${etiquetaDia(partesColombia(v.inicio).fecha, hoy)}, ${horaCorta(v.inicio)} – ${horaCorta(v.fin)}`;
}

export function clasificarVisitas({
  visitas,
  expedientes,
  userId,
  planificador,
  ahora,
}: {
  visitas: VisitaAlerta[];
  expedientes: ExpedienteAlerta[];
  userId: string;
  planificador: boolean;
  ahora: Date;
}): ResumenVisitas {
  const hoy = partesColombia(ahora).fecha;
  const limite = sumarDias(hoy, DIAS_PROXIMAS);
  const programadas = visitas.filter((v) => v.estado === "PROGRAMADA").sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const alerta = (v: VisitaAlerta, texto: string, destacada?: boolean): AlertaVisita => ({
    expedienteId: v.expedienteId,
    visitaId: v.id,
    numero: v.numero,
    tramite: v.tramite,
    texto,
    destacada,
  });

  const proximas = programadas
    .filter((v) => v.profesionalId === userId && v.fin >= ahora && partesColombia(v.inicio).fecha <= limite)
    .map((v) => alerta(v, `${cuando(v, hoy)} · ${v.lugar}`, partesColombia(v.inicio).fecha <= sumarDias(hoy, 1)));

  const porRegistrar = programadas.filter((v) => v.profesionalId === userId && v.fin < ahora).map((v) => alerta(v, `${cuando(v, hoy)} · ${v.lugar}`, true));

  const equipoVencidas = planificador
    ? programadas.filter((v) => v.profesionalId !== userId && v.fin < ahora).map((v) => alerta(v, `${cuando(v, hoy)} · ${v.profesional}`))
    : [];

  const porReprogramar: AlertaVisita[] = [];
  const sinProgramar: AlertaVisita[] = [];
  if (planificador) {
    for (const e of expedientes) {
      if (e.visitas.some((v) => v.estado === "PROGRAMADA")) continue;
      const ultima = [...e.visitas].sort((a, b) => b.inicio.getTime() - a.inicio.getTime())[0];
      const base = { expedienteId: e.id, numero: e.numero, tramite: e.tramite };
      if (ultima?.estado === "NO_REALIZADA") {
        porReprogramar.push({ ...base, texto: `La visita del ${etiquetaDia(partesColombia(ultima.inicio).fecha, hoy).toLowerCase()} no se pudo realizar` });
        continue;
      }
      const titulo = e.pasoTitulo ?? "";
      const enPasoDeVisita = pasoPermiteVisita(titulo, e.pasoDescripcion);
      if (enPasoDeVisita && !e.pasosConHoja.includes(e.pasoActualNumero) && ultima?.estado !== "REALIZADA") {
        sinProgramar.push({ ...base, texto: `Paso ${e.pasoActualNumero}: ${titulo}` });
      }
    }
  }

  return {
    proximas,
    porRegistrar,
    equipoVencidas,
    porReprogramar,
    sinProgramar,
    hayAlgo: proximas.length + porRegistrar.length + equipoVencidas.length + porReprogramar.length + sinProgramar.length > 0,
  };
}

export async function getPendientesVisitas(opts: { userId: string; planificador: boolean; tramitesPermitidos: string[] | null }): Promise<ResumenVisitas> {
  const ahora = new Date();
  const hasta = new Date(ahora.getTime() + (DIAS_PROXIMAS + 1) * 24 * 60 * 60 * 1000);
  const filtroTramite = opts.tramitesPermitidos ? { tramiteTipoId: { in: opts.tramitesPermitidos } } : {};

  const [visitas, expedientes] = await Promise.all([
    db.visitaProgramada.findMany({
      where: {
        estado: "PROGRAMADA",
        fechaHora: { lt: hasta },
        ...(opts.planificador ? {} : { profesionalId: opts.userId }),
        expediente: { archivado: false, estado: { notIn: [...ESTADOS_TERMINALES_EXPEDIENTE] }, ...(opts.planificador ? filtroTramite : {}) },
      },
      select: {
        id: true,
        expedienteId: true,
        profesionalId: true,
        fechaHora: true,
        fechaHoraFin: true,
        estado: true,
        lugar: true,
        profesional: { select: { nombre: true } },
        expediente: { select: { numero: true, tramiteTipo: { select: { nombre: true } } } },
      },
    }),
    opts.planificador
      ? db.expediente.findMany({
          where: { archivado: false, estado: { notIn: [...ESTADOS_TERMINALES_EXPEDIENTE] }, ...filtroTramite },
          select: {
            id: true,
            numero: true,
            flujoId: true,
            pasoActualNumero: true,
            tramiteTipo: { select: { nombre: true } },
            visitasProgramadas: { select: { estado: true, fechaHora: true } },
            visitasTecnicas: { select: { pasoNumero: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const pasos = expedientes.length
    ? await db.pasoDefinicion.findMany({
        where: { OR: expedientes.map((e) => ({ flujoId: e.flujoId, numero: e.pasoActualNumero })) },
        select: { flujoId: true, numero: true, titulo: true, descripcion: true },
      })
    : [];
  const pasoDe = (e: { flujoId: string; pasoActualNumero: number }) => pasos.find((p) => p.flujoId === e.flujoId && p.numero === e.pasoActualNumero);

  return clasificarVisitas({
    userId: opts.userId,
    planificador: opts.planificador,
    ahora,
    visitas: visitas.map((v) => ({
      id: v.id,
      expedienteId: v.expedienteId,
      numero: v.expediente.numero,
      tramite: v.expediente.tramiteTipo.nombre,
      profesionalId: v.profesionalId,
      profesional: v.profesional.nombre,
      inicio: v.fechaHora,
      fin: finEfectivo(v),
      estado: v.estado,
      lugar: v.lugar,
    })),
    expedientes: expedientes.map((e) => ({
      id: e.id,
      numero: e.numero,
      tramite: e.tramiteTipo.nombre,
      pasoActualNumero: e.pasoActualNumero,
      pasoTitulo: pasoDe(e)?.titulo ?? null,
      pasoDescripcion: pasoDe(e)?.descripcion ?? null,
      visitas: e.visitasProgramadas.map((v) => ({ estado: v.estado, inicio: v.fechaHora })),
      pasosConHoja: e.visitasTecnicas.map((v) => v.pasoNumero),
    })),
  });
}

export async function contarAlertasVisitasPropias(userId: string): Promise<number> {
  const hoy = partesColombia(new Date()).fecha;
  const finManana = new Date(`${sumarDias(hoy, 2)}T00:00:00-05:00`);
  return db.visitaProgramada.count({
    where: {
      profesionalId: userId,
      estado: "PROGRAMADA",
      fechaHora: { lt: finManana },
      expediente: { archivado: false, estado: { notIn: [...ESTADOS_TERMINALES_EXPEDIENTE] } },
    },
  });
}
