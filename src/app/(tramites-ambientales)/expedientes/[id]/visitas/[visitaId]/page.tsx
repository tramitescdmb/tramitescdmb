import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, MapPin, User, AlertTriangle, ClipboardCheck, Info } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederTramite, puedeEditarTramite, puedePlanearVisitas } from "@/lib/permisos";
import { CLASE_ESTADO_VISITA, ETIQUETA_ESTADO_VISITA, expedienteEnEjecucion, finEfectivo, horaCorta, partesColombia, sumarMinutosHora } from "@/lib/planeador";
import { rangoTexto, temasDeVisita } from "@/lib/planeador-db";
import { CLASE_RESULTADO_VISITA, ETIQUETA_RESULTADO_VISITA, esPasoDeVisita, ordenarTemasParaTramite, visitaHabilitadaParaRegistro } from "@/lib/temas-visita";
import { formatearFechaHora } from "@/lib/fecha";
import { MapaSoloLectura } from "@/components/MapaSoloLectura";
import { RegistrarVisitaForm } from "@/components/planeador/RegistrarVisitaForm";
import { AccionesVisita } from "@/components/planeador/AccionesVisita";

export default async function HojaVisitaPage({ params }: { params: Promise<{ id: string; visitaId: string }> }) {
  const { id, visitaId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const visita = await db.visitaProgramada.findUnique({
    where: { id: visitaId },
    include: {
      profesional: { select: { nombre: true } },
      programadaPor: { select: { nombre: true } },
      expediente: {
        select: {
          id: true,
          numero: true,
          estado: true,
          archivado: true,
          pasoActualNumero: true,
          tramiteTipoId: true,
          tramiteTipo: { select: { nombre: true, codigo: true } },
          flujo: { select: { pasos: { select: { numero: true, titulo: true }, orderBy: { numero: "asc" } } } },
        },
      },
      visitaTecnica: {
        include: {
          temas: { select: { id: true, nombre: true }, orderBy: { nombre: "asc" } },
          fotos: { select: { id: true, tomadaEn: true }, orderBy: { createdAt: "asc" } },
          capturadoPor: { select: { nombre: true } },
        },
      },
    },
  });
  if (!visita || visita.expedienteId !== id) notFound();

  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederTramite(permisos, visita.expediente.tramiteTipoId)) notFound();
  const planificador = puedePlanearVisitas(permisos);
  const esProfesional = session.userId === visita.profesionalId;
  const enEjecucion = expedienteEnEjecucion(visita.expediente);
  const ahora = partesColombia(new Date());
  const programada = partesColombia(visita.fechaHora);
  const yaLlegoElDia = visitaHabilitadaParaRegistro(programada.fecha, ahora.fecha);
  const puedeRegistrar =
    visita.estado === "PROGRAMADA" && enEjecucion && (planificador || esProfesional) && puedeEditarTramite(permisos, visita.expediente.tramiteTipoId);

  const pasos = visita.expediente.flujo.pasos;
  const pasoActual = pasos.find((p) => p.numero === visita.expediente.pasoActualNumero);
  const pasoVisita = pasos.find((p) => esPasoDeVisita(p.titulo));
  const vt = visita.visitaTecnica;

  const temas = puedeRegistrar && yaLlegoElDia ? await temasDeVisita() : [];
  const { sugeridos, otros } = ordenarTemasParaTramite(temas, visita.expediente.tramiteTipo.codigo);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href={`/expedientes/${id}#planeador`} className="text-sm text-cdmb-700 hover:underline">
          ← {visita.expediente.numero}
        </Link>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-stone-900">
          <ClipboardCheck className="h-5 w-5 text-cdmb-700" aria-hidden />
          Hoja de visita técnica
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASE_ESTADO_VISITA[visita.estado]}`}>{ETIQUETA_ESTADO_VISITA[visita.estado]}</span>
        </h2>
        <p className="text-sm text-stone-500">{visita.expediente.tramiteTipo.nombre}</p>
      </div>

      <section className="grid grid-cols-1 gap-2 rounded-xl border border-stone-200 bg-white p-4 text-sm shadow-soft sm:grid-cols-3">
        <p className="flex gap-2">
          <CalendarClock className="mt-0.5 h-4 w-4 flex-none text-stone-400" aria-hidden />
          <span>
            <span className="block text-xs text-stone-400">Programada</span>
            {rangoTexto(visita.fechaHora, visita.fechaHoraFin)}
          </span>
        </p>
        <p className="flex gap-2">
          <MapPin className="mt-0.5 h-4 w-4 flex-none text-stone-400" aria-hidden />
          <span>
            <span className="block text-xs text-stone-400">Lugar</span>
            {visita.lugar}
          </span>
        </p>
        <p className="flex gap-2">
          <User className="mt-0.5 h-4 w-4 flex-none text-stone-400" aria-hidden />
          <span>
            <span className="block text-xs text-stone-400">Profesional</span>
            {visita.profesional.nombre}
          </span>
        </p>
        {visita.observaciones && <p className="text-xs text-stone-500 sm:col-span-3">Indicaciones: {visita.observaciones}</p>}
      </section>

      {visita.estado === "PROGRAMADA" && pasoVisita && pasoActual && pasoActual.numero !== pasoVisita.numero && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
          El expediente está en el paso {pasoActual.numero} ({pasoActual.titulo.toLowerCase()}); según el procedimiento, la visita corresponde al paso{" "}
          {pasoVisita.numero} ({pasoVisita.titulo.toLowerCase()}). La hoja quedará registrada en el paso {pasoActual.numero}.
        </p>
      )}

      {(visita.estado === "NO_REALIZADA" || visita.estado === "CANCELADA") && (
        <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
          {visita.estado === "NO_REALIZADA" ? "La visita no se pudo realizar." : "La visita fue cancelada."} Motivo: {visita.motivoCambio}
        </p>
      )}

      {vt && (
        <div className="space-y-3">
          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-soft">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-stone-700">
                Realizada el {vt.inicioReal ? rangoTexto(vt.inicioReal, vt.finReal) : formatearFechaHora(vt.capturadoEn)}
              </p>
              {vt.resultado && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASE_RESULTADO_VISITA[vt.resultado]}`}>{ETIQUETA_RESULTADO_VISITA[vt.resultado]}</span>
              )}
            </div>
            <MapaSoloLectura lat={vt.lat} lon={vt.lon} />
            <p className="mt-1.5 text-xs text-stone-500">
              {vt.lat.toFixed(6)}, {vt.lon.toFixed(6)}
              {vt.planaX != null && vt.planaY != null && ` · Planas MAGNA-SIRGAS: X ${vt.planaX.toLocaleString("es-CO")} m, Y ${vt.planaY.toLocaleString("es-CO")} m`}
              {vt.capturaManual ? " · Ingresado manualmente" : vt.precisionM != null && ` · Precisión ±${Math.round(vt.precisionM)} m`}
              {vt.fueraJurisdiccion && " · Fuera de la jurisdicción CDMB"}
            </p>
          </section>

          <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 text-sm shadow-soft">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Temas</p>
              <div className="flex flex-wrap gap-1.5">
                {vt.temas.map((t) => (
                  <span key={t.id} className="rounded-full bg-cdmb-50 px-2.5 py-1 text-xs text-cdmb-800">
                    {t.nombre}
                  </span>
                ))}
              </div>
            </div>
            {vt.atendidoPor && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Atendió la visita</p>
                <p className="text-stone-800">{vt.atendidoPor}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Hallazgos y observaciones</p>
              <p className="whitespace-pre-line text-stone-800">{vt.hallazgos ?? vt.nota}</p>
            </div>
            {vt.recomendaciones && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Recomendaciones o requerimientos</p>
                <p className="whitespace-pre-line text-stone-800">{vt.recomendaciones}</p>
              </div>
            )}
            <p className="text-[11px] text-stone-400">
              Registrada por {vt.capturadoPor.nombre} el {formatearFechaHora(vt.createdAt)} · paso {vt.pasoNumero}
            </p>
          </section>

          {vt.fotos.length > 0 && (
            <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-soft">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Registro fotográfico ({vt.fotos.length})</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {vt.fotos.map((f, i) => (
                  <a key={f.id} href={`/api/visitas-fotos/${f.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-stone-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/visitas-fotos/${f.id}`} alt={`Foto ${i + 1} de la visita`} className="aspect-square w-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {visita.estado === "PROGRAMADA" &&
        (puedeRegistrar ? (
          yaLlegoElDia ? (
            <>
              <RegistrarVisitaForm
                visitaId={visita.id}
                expedienteId={id}
                sugeridos={sugeridos.map((t) => ({ id: t.id, nombre: t.nombre }))}
                otros={otros.map((t) => ({ id: t.id, nombre: t.nombre }))}
                iniciales={{
                  fechaReal: ahora.fecha,
                  horaInicioReal: ahora.hora,
                  horaFinReal: sumarMinutosHora(ahora.hora, Math.round((finEfectivo(visita).getTime() - visita.fechaHora.getTime()) / 60_000)),
                }}
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3">
                <span className="text-xs text-stone-500">¿No se pudo realizar?</span>
                <AccionesVisita visitaId={visita.id} puedeNoRealizada puedeCancelar={false} />
              </div>
            </>
          ) : (
            <p className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              <Info className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
              La hoja de visita se habilita el día programado ({rangoTexto(visita.fechaHora, visita.fechaHoraFin)}).
            </p>
          )
        ) : (
          <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
            Pendiente de que {visita.profesional.nombre} registre la visita ({horaCorta(visita.fechaHora)}).
          </p>
        ))}
    </div>
  );
}
