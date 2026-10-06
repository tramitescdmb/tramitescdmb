import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, User, ClipboardList } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedePlanearVisitas } from "@/lib/permisos";
import {
  CLASE_ESTADO_VISITA,
  ETIQUETA_ESTADO_VISITA,
  claveMes,
  desplazarMes,
  horaCorta,
  mesValido,
  partesColombia,
  rangoMes,
  semanasDelMes,
} from "@/lib/planeador";
import { ESTADOS_TERMINALES_EXPEDIENTE } from "@/lib/estados-expediente";
import { formatearFecha } from "@/lib/fecha";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const ESTADOS_VISITA = ["PROGRAMADA", "REALIZADA", "CANCELADA"] as const;
const PUNTO_ESTADO: Record<string, string> = {
  PROGRAMADA: "bg-sky-500",
  REALIZADA: "bg-emerald-500",
  CANCELADA: "bg-stone-300",
};

export default async function PlaneadorPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; profesional?: string; estado?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  const planificador = puedePlanearVisitas(permisos);
  const sp = await searchParams;

  const { anio, mes } = mesValido(sp.mes);
  const { desde, hasta } = rangoMes(anio, mes);
  const anterior = desplazarMes(anio, mes, -1);
  const siguiente = desplazarMes(anio, mes, 1);
  const hoy = partesColombia(new Date()).fecha;
  const profesionalFiltro = planificador ? sp.profesional || "" : session.userId;
  const estadoFiltro = (ESTADOS_VISITA as readonly string[]).includes(sp.estado ?? "") ? sp.estado! : "";

  const where: Prisma.VisitaProgramadaWhereInput = {
    fechaHora: { gte: desde, lt: hasta },
    ...(profesionalFiltro ? { profesionalId: profesionalFiltro } : {}),
    ...(estadoFiltro ? { estado: estadoFiltro as (typeof ESTADOS_VISITA)[number] } : {}),
  };

  const [visitas, profesionales] = await Promise.all([
    db.visitaProgramada.findMany({
      where,
      orderBy: { fechaHora: "asc" },
      select: {
        id: true,
        fechaHora: true,
        lugar: true,
        estado: true,
        profesional: { select: { nombre: true } },
        expediente: { select: { id: true, numero: true, municipio: true, tramiteTipoId: true, tramiteTipo: { select: { nombre: true } } } },
      },
    }),
    planificador
      ? db.usuario.findMany({
          where: { visitasProgramadas: { some: {} } },
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true },
        })
      : Promise.resolve([]),
  ]);

  const puedeAbrir = (tramiteTipoId: string) => permisos.esAdmin || permisos.tramites.has(tramiteTipoId);
  const porDia = new Map<string, typeof visitas>();
  for (const v of visitas) {
    const dia = partesColombia(v.fechaHora).fecha;
    porDia.set(dia, [...(porDia.get(dia) ?? []), v]);
  }
  const conteo = Object.fromEntries(ESTADOS_VISITA.map((e) => [e, visitas.filter((v) => v.estado === e).length]));
  const nombreMes = new Date(Date.UTC(anio, mes - 1, 15)).toLocaleDateString("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });

  const porProgramar = planificador ? await expedientesPorProgramar(permisos.esAdmin ? null : [...permisos.tramites.keys()]) : [];

  const enlace = (cambios: Record<string, string>) => {
    const p = new URLSearchParams();
    const base = { mes: claveMes(anio, mes), profesional: planificador ? profesionalFiltro : "", estado: estadoFiltro, ...cambios };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    return `/planeador?${p.toString()}`;
  };

  const tarjetaVisita = (v: (typeof visitas)[number], compacta: boolean) => {
    const contenido = (
      <>
        <span className="flex items-center gap-1">
          <span className={`h-1.5 w-1.5 flex-none rounded-full ${PUNTO_ESTADO[v.estado]}`} aria-hidden />
          <span className="whitespace-nowrap font-semibold">{horaCorta(v.fechaHora)}</span>
          {!compacta && <span className={v.estado === "CANCELADA" ? "line-through" : ""}>{v.expediente.numero}</span>}
        </span>
        {compacta && <span className={`block truncate ${v.estado === "CANCELADA" ? "line-through" : ""}`}>{v.expediente.numero}</span>}
        {compacta ? (
          <span className="block truncate text-stone-500">{v.profesional.nombre}</span>
        ) : (
          <>
            <span className="block text-stone-600">{v.expediente.tramiteTipo.nombre}</span>
            <span className="flex items-center gap-1 text-stone-500">
              <MapPin className="h-3 w-3 flex-none" aria-hidden />
              {v.lugar}
            </span>
            <span className="flex items-center gap-1 text-stone-500">
              <User className="h-3 w-3 flex-none" aria-hidden />
              {v.profesional.nombre}
            </span>
          </>
        )}
      </>
    );
    const clase = `block rounded-md border border-stone-200 bg-white px-1.5 py-1 text-[11px] leading-tight ${compacta ? "" : "px-3 py-2 text-xs"}`;
    const titulo = `${horaCorta(v.fechaHora)} · ${v.expediente.numero} · ${v.lugar} · ${v.profesional.nombre} · ${ETIQUETA_ESTADO_VISITA[v.estado]}`;
    return puedeAbrir(v.expediente.tramiteTipoId) ? (
      <Link key={v.id} href={`/expedientes/${v.expediente.id}#planeador`} title={titulo} className={`${clase} hover:border-cdmb-300 hover:bg-cdmb-50`}>
        {contenido}
      </Link>
    ) : (
      <div key={v.id} title={titulo} className={clase}>
        {contenido}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-stone-900">
            <CalendarDays className="h-4 w-4 text-cdmb-700" aria-hidden />
            {planificador ? "Cronograma de visitas técnicas" : "Mis visitas técnicas"}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Link href={enlace({ mes: claveMes(anterior.anio, anterior.mes) })} aria-label="Mes anterior" className="rounded-md border border-stone-200 bg-white p-1.5 text-stone-600 hover:bg-stone-50">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <span className="min-w-36 text-center text-sm font-semibold text-stone-800">{nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}</span>
          <Link href={enlace({ mes: claveMes(siguiente.anio, siguiente.mes) })} aria-label="Mes siguiente" className="rounded-md border border-stone-200 bg-white p-1.5 text-stone-600 hover:bg-stone-50">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href={enlace({ mes: hoy.slice(0, 7) })} className="ml-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50">
            Hoy
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex flex-wrap items-end gap-2 text-xs">
          <input type="hidden" name="mes" value={claveMes(anio, mes)} />
          {planificador && (
            <label className="text-stone-500">
              Profesional
              <select name="profesional" defaultValue={profesionalFiltro} className="mt-0.5 block rounded-md border border-stone-200 px-2 py-1.5 text-xs text-stone-800">
                <option value="">Todos</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-stone-500">
            Estado
            <select name="estado" defaultValue={estadoFiltro} className="mt-0.5 block rounded-md border border-stone-200 px-2 py-1.5 text-xs text-stone-800">
              <option value="">Todos</option>
              {ESTADOS_VISITA.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO_VISITA[e]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-md border border-stone-200 bg-white px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-50">
            Filtrar
          </button>
        </form>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {ESTADOS_VISITA.map((e) => (
            <span key={e} className={`rounded-full px-2 py-0.5 font-medium ${CLASE_ESTADO_VISITA[e].replace("line-through", "")}`}>
              {ETIQUETA_ESTADO_VISITA[e]}: {conteo[e]}
            </span>
          ))}
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft md:block">
        <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-500">
          {DIAS.map((d) => (
            <div key={d} className="py-1.5">
              {d}
            </div>
          ))}
        </div>
        {semanasDelMes(anio, mes).map((semana, i) => (
          <div key={i} className="grid grid-cols-7 border-b border-stone-100 last:border-b-0">
            {semana.map((dia, j) => (
              <div key={j} className={`min-h-24 border-r border-stone-100 p-1 last:border-r-0 ${dia ? "" : "bg-stone-50/60"}`}>
                {dia && (
                  <>
                    <p className={`mb-1 text-right text-[11px] ${dia === hoy ? "font-semibold text-cdmb-700" : "text-stone-400"}`}>
                      {dia === hoy ? <span className="rounded-full bg-menu-500 px-1.5 py-0.5 text-stone-900">{Number(dia.slice(8))}</span> : Number(dia.slice(8))}
                    </p>
                    <div className="space-y-1">{(porDia.get(dia) ?? []).map((v) => tarjetaVisita(v, true))}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="space-y-3 md:hidden">
        {visitas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-200 bg-white px-4 py-6 text-center text-sm text-stone-400">Sin visitas en este mes.</p>
        ) : (
          [...porDia.entries()].map(([dia, lista]) => (
            <div key={dia}>
              <p className={`mb-1 text-xs font-semibold ${dia === hoy ? "text-cdmb-700" : "text-stone-500"}`}>{formatearFecha(`${dia}T12:00:00-05:00`)}</p>
              <div className="space-y-1.5">{lista.map((v) => tarjetaVisita(v, false))}</div>
            </div>
          ))
        )}
      </div>

      {planificador && (
        <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-stone-900">
            <ClipboardList className="h-4 w-4 text-stone-400" aria-hidden />
            Trámites en ejecución sin visita pendiente ({porProgramar.length})
          </h3>
          {porProgramar.length === 0 ? (
            <p className="text-sm text-stone-400">Todos los trámites en ejecución tienen una visita programada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="py-1.5 pr-3 font-medium">Expediente</th>
                    <th className="py-1.5 pr-3 font-medium">Trámite</th>
                    <th className="py-1.5 pr-3 font-medium">Municipio</th>
                    <th className="py-1.5 pr-3 font-medium">Paso actual</th>
                    <th className="py-1.5 font-medium">Personal asignado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {porProgramar.map((e) => (
                    <tr key={e.id} className={e.pasoDeVisita ? "bg-amber-50/60" : ""}>
                      <td className="py-1.5 pr-3">
                        <Link href={`/expedientes/${e.id}#planeador`} className="font-medium text-cdmb-700 hover:underline">
                          {e.numero}
                        </Link>
                      </td>
                      <td className="py-1.5 pr-3 text-stone-700">{e.tramite}</td>
                      <td className="py-1.5 pr-3 text-stone-700">{e.municipio}</td>
                      <td className="py-1.5 pr-3 text-stone-700">
                        {e.paso}
                        {e.pasoDeVisita && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">Visita técnica</span>}
                      </td>
                      <td className="py-1.5 text-stone-700">{e.asignados || <span className="text-stone-400">Sin asignar</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

async function expedientesPorProgramar(tramitesPermitidos: string[] | null) {
  const expedientes = await db.expediente.findMany({
    where: {
      archivado: false,
      estado: { notIn: [...ESTADOS_TERMINALES_EXPEDIENTE] },
      visitasProgramadas: { none: { estado: "PROGRAMADA" } },
      ...(tramitesPermitidos ? { tramiteTipoId: { in: tramitesPermitidos } } : {}),
    },
    orderBy: { fechaRadicacion: "asc" },
    take: 200,
    select: {
      id: true,
      numero: true,
      municipio: true,
      flujoId: true,
      pasoActualNumero: true,
      tramiteTipo: { select: { nombre: true } },
      usuariosAsignados: { select: { nombre: true } },
    },
  });
  const pasos = expedientes.length
    ? await db.pasoDefinicion.findMany({
        where: { OR: expedientes.map((e) => ({ flujoId: e.flujoId, numero: e.pasoActualNumero })) },
        select: { flujoId: true, numero: true, titulo: true },
      })
    : [];
  const filas = expedientes.map((e) => {
    const paso = pasos.find((p) => p.flujoId === e.flujoId && p.numero === e.pasoActualNumero);
    return {
      id: e.id,
      numero: e.numero,
      municipio: e.municipio,
      tramite: e.tramiteTipo.nombre,
      paso: paso ? `${paso.numero}. ${paso.titulo}` : String(e.pasoActualNumero),
      pasoDeVisita: Boolean(paso && /visita/i.test(paso.titulo)),
      asignados: e.usuariosAsignados.map((u) => u.nombre).join(", "),
    };
  });
  return filas.sort((a, b) => Number(b.pasoDeVisita) - Number(a.pasoDeVisita));
}
