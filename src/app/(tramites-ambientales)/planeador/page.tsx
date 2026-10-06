import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedePlanearVisitas } from "@/lib/permisos";
import {
  diasDeVista,
  expedienteEnEjecucion,
  fechaHoraColombia,
  fechaValida,
  finEfectivo,
  lugarSugerido,
  partesColombia,
  sumarDias,
  vistaValida,
} from "@/lib/planeador";
import { ESTADOS_TERMINALES_EXPEDIENTE } from "@/lib/estados-expediente";
import { PALETA_TIPOS, COLOR_OTROS_TIPOS } from "@/lib/geovisor-capas-externas";
import { CalendarioPlaneador, type VisitaCalendario } from "@/components/planeador/CalendarioPlaneador";
import type { ExpedienteParaVisita } from "@/components/planeador/ProgramarVisitaForm";

export default async function PlaneadorPage({ searchParams }: { searchParams: Promise<{ vista?: string; fecha?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  const planificador = puedePlanearVisitas(permisos);
  const sp = await searchParams;

  const hoy = partesColombia(new Date()).fecha;
  const vista = vistaValida(sp.vista);
  const fecha = fechaValida(sp.fecha, hoy);
  const dias = diasDeVista(vista, fecha);
  const desde = fechaHoraColombia(dias[0]!, "00:00")!;
  const hasta = fechaHoraColombia(sumarDias(dias.at(-1)!, 1), "00:00")!;

  const [visitas, profesionales, expedientes] = await Promise.all([
    db.visitaProgramada.findMany({
      where: { fechaHora: { gte: desde, lt: hasta }, ...(planificador ? {} : { profesionalId: session.userId }) },
      orderBy: { fechaHora: "asc" },
      include: {
        profesional: { select: { nombre: true } },
        programadaPor: { select: { nombre: true } },
        visitaTecnica: { select: { id: true } },
        expediente: {
          select: {
            id: true,
            numero: true,
            municipio: true,
            estado: true,
            archivado: true,
            tramiteTipoId: true,
            tramiteTipo: { select: { nombre: true } },
            usuariosAsignados: { select: { id: true, nombre: true } },
          },
        },
      },
    }),
    planificador
      ? db.usuario.findMany({
          where: {
            OR: [
              { visitasProgramadas: { some: {} } },
              { activo: true, expedientesAsignacion: { some: { archivado: false, estado: { notIn: [...ESTADOS_TERMINALES_EXPEDIENTE] } } } },
            ],
          },
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true },
        })
      : Promise.resolve([{ id: session.userId, nombre: session.nombre }]),
    planificador ? expedientesEnEjecucion(permisos.esAdmin ? null : [...permisos.tramites.keys()]) : Promise.resolve([]),
  ]);

  const colores = new Map(profesionales.map((p, i) => [p.id, PALETA_TIPOS[i] ?? COLOR_OTROS_TIPOS]));
  const ahora = partesColombia(new Date());

  const datos: VisitaCalendario[] = visitas.map((v) => {
    const { fecha: dia, hora } = partesColombia(v.fechaHora);
    const fin = finEfectivo(v);
    const minutos = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
    return {
      id: v.id,
      dia,
      hora,
      horaFin: partesColombia(fin).hora,
      minutos,
      duracion: Math.max(30, Math.min(24 * 60 - minutos, Math.round((fin.getTime() - v.fechaHora.getTime()) / 60_000))),
      tieneHoja: Boolean(v.visitaTecnica),
      puedeRegistrar: planificador || v.profesionalId === session.userId,
      lugar: v.lugar,
      estado: v.estado,
      observaciones: v.observaciones,
      motivoCambio: v.motivoCambio,
      profesionalId: v.profesionalId,
      profesional: v.profesional.nombre,
      programadaPor: v.programadaPor.nombre,
      color: colores.get(v.profesionalId) ?? COLOR_OTROS_TIPOS,
      expediente: {
        id: v.expediente.id,
        numero: v.expediente.numero,
        tramite: v.expediente.tramiteTipo.nombre,
        municipio: v.expediente.municipio,
        enEjecucion: expedienteEnEjecucion(v.expediente),
        puedeAbrir: permisos.esAdmin || permisos.tramites.has(v.expediente.tramiteTipoId),
        asignados: v.expediente.usuariosAsignados,
      },
    };
  });

  return (
    <CalendarioPlaneador
      vista={vista}
      fecha={fecha}
      dias={dias}
      hoy={hoy}
      horaActual={ahora.hora}
      planificador={planificador}
      usuarioId={session.userId}
      visitas={datos}
      profesionales={profesionales.map((p) => ({ ...p, color: colores.get(p.id)! }))}
      expedientes={expedientes}
    />
  );
}

async function expedientesEnEjecucion(tramitesPermitidos: string[] | null): Promise<ExpedienteParaVisita[]> {
  const expedientes = await db.expediente.findMany({
    where: {
      archivado: false,
      estado: { notIn: [...ESTADOS_TERMINALES_EXPEDIENTE] },
      ...(tramitesPermitidos ? { tramiteTipoId: { in: tramitesPermitidos } } : {}),
    },
    orderBy: { fechaRadicacion: "asc" },
    take: 2000,
    select: {
      id: true,
      numero: true,
      municipio: true,
      predioDireccion: true,
      predioNombre: true,
      predioCatastral: true,
      predioMatricula: true,
      solicitanteNombre: true,
      solicitanteIdentificacion: true,
      tramiteTipo: { select: { nombre: true } },
      usuariosAsignados: { select: { id: true, nombre: true }, orderBy: { nombre: "asc" } },
      _count: { select: { visitasProgramadas: { where: { estado: "PROGRAMADA" } } } },
    },
  });
  return expedientes.map((e) => ({
    id: e.id,
    numero: e.numero,
    tramite: e.tramiteTipo.nombre,
    solicitante: e.solicitanteNombre,
    identificacion: e.solicitanteIdentificacion,
    municipio: e.municipio,
    otrosIdentificadores: [e.predioCatastral, e.predioMatricula].filter((x): x is string => Boolean(x)),
    lugar: lugarSugerido(e),
    asignados: e.usuariosAsignados,
    porProgramar: e._count.visitasProgramadas === 0,
  }));
}
