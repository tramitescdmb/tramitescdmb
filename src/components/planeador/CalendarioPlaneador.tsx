"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, ChevronLeft, ChevronRight, MapPin, User, X, Check, ExternalLink, PanelLeft, Clock, FileText, ClipboardList, ClipboardCheck, Search } from "lucide-react";
import {
  CLASE_ESTADO_VISITA,
  ETIQUETA_ESTADO_VISITA,
  VISTAS_CALENDARIO,
  desplazarVista,
  diasDeVista,
  filtrarExpedientes,
  partesColombia,
  sumarMeses,
  sumarMinutosHora,
  ubicarBloques,
  type VistaCalendario,
} from "@/lib/planeador";
import { ModalVisita, ProgramarVisitaForm, type ExpedienteParaVisita } from "@/components/planeador/ProgramarVisitaForm";
import { AccionesVisita } from "@/components/planeador/AccionesVisita";

export type VisitaCalendario = {
  id: string;
  dia: string;
  hora: string;
  horaFin: string;
  minutos: number;
  duracion: number;
  tieneHoja: boolean;
  puedeRegistrar: boolean;
  lugar: string;
  estado: string;
  observaciones: string | null;
  motivoCambio: string | null;
  profesionalId: string;
  profesional: string;
  programadaPor: string;
  color: string;
  expediente: {
    id: string;
    numero: string;
    tramite: string;
    municipio: string;
    enEjecucion: boolean;
    puedeAbrir: boolean;
    asignados: { id: string; nombre: string }[];
  };
};

const HORA_PX = 48;
const INICIO_JORNADA = 7;
const FIN_JORNADA = 18;
const SEMANA = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function fechaUtc(dia: string) {
  return new Date(`${dia}T12:00:00Z`);
}

function formato(dia: string, opciones: Intl.DateTimeFormatOptions) {
  return fechaUtc(dia).toLocaleDateString("es-CO", { ...opciones, timeZone: "UTC" });
}

function mayuscula(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function hora12(hora: string) {
  const h = Number(hora.slice(0, 2));
  const m = hora.slice(3, 5);
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? "a. m." : "p. m."}`;
}

function etiquetaHora(h: number) {
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "a. m." : "p. m."}`;
}

function tituloPeriodo(vista: VistaCalendario, fecha: string, dias: string[]) {
  if (vista === "dia") return mayuscula(formato(fecha, { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  if (vista === "mes") return mayuscula(formato(fecha, { month: "long", year: "numeric" }));
  const a = dias[0]!;
  const b = dias.at(-1)!;
  if (a.slice(0, 7) === b.slice(0, 7)) return `${Number(a.slice(8))} – ${formato(b, { day: "numeric", month: "long", year: "numeric" })}`;
  if (a.slice(0, 4) === b.slice(0, 4)) return `${formato(a, { day: "numeric", month: "long" })} – ${formato(b, { day: "numeric", month: "long", year: "numeric" })}`;
  return `${formato(a, { day: "numeric", month: "short", year: "numeric" })} – ${formato(b, { day: "numeric", month: "short", year: "numeric" })}`;
}

function enlace(vista: VistaCalendario, fecha: string) {
  return `/planeador?vista=${vista}&fecha=${fecha}`;
}

export function CalendarioPlaneador({
  vista,
  fecha,
  dias,
  hoy,
  horaActual,
  planificador,
  usuarioId,
  visitas,
  profesionales,
  expedientes,
}: {
  vista: VistaCalendario;
  fecha: string;
  dias: string[];
  hoy: string;
  horaActual: string;
  planificador: boolean;
  usuarioId: string;
  visitas: VisitaCalendario[];
  profesionales: { id: string; nombre: string; color: string }[];
  expedientes: ExpedienteParaVisita[];
}) {
  const router = useRouter();
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [nueva, setNueva] = useState<{ fecha: string; hora: string; expedienteId?: string } | null>(null);
  const [panelMovil, setPanelMovil] = useState(false);

  const visibles = useMemo(
    () => visitas.filter((v) => !ocultos.has(v.profesionalId) && (mostrarCanceladas || v.estado !== "CANCELADA")),
    [visitas, ocultos, mostrarCanceladas]
  );
  const porDia = useMemo(() => {
    const m = new Map<string, VisitaCalendario[]>();
    for (const v of visibles) m.set(v.dia, [...(m.get(v.dia) ?? []), v]);
    return m;
  }, [visibles]);
  const seleccion = visitas.find((v) => v.id === seleccionId) ?? null;
  const porProgramar = useMemo(() => expedientes.filter((e) => e.porProgramar), [expedientes]);
  const [busquedaPendientes, setBusquedaPendientes] = useState("");
  const pendientesFiltrados = useMemo(() => filtrarExpedientes(porProgramar, busquedaPendientes), [porProgramar, busquedaPendientes]);

  const abrirNueva = (dia: string, hora: string, expedienteId?: string) => {
    if (!planificador) return;
    setSeleccionId(null);
    setNueva({ fecha: dia < hoy ? hoy : dia, hora, expedienteId });
  };

  const panelIzquierdo = (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-3">
      {planificador && (
        <button
          type="button"
          onClick={() => abrirNueva(vista === "mes" || vista === "agenda" ? (fecha < hoy ? hoy : fecha) : dias.includes(hoy) ? hoy : dias[0]!, "08:00")}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-acento-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-acento-600"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden />
          Nueva visita
        </button>
      )}

      <MiniCalendario key={fecha.slice(0, 7)} fecha={fecha} hoy={hoy} vista={vista} diasVisibles={dias} />

      <div>
        <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">{planificador ? "Profesionales" : "Calendario"}</p>
        {profesionales.length === 0 ? (
          <p className="px-1 text-xs text-stone-400">Aún no hay personal asignado a trámites en ejecución.</p>
        ) : (
          <ul className="space-y-0.5">
            {profesionales.map((p) => {
              const activo = !ocultos.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setOcultos((prev) => {
                        const n = new Set(prev);
                        if (n.has(p.id)) n.delete(p.id);
                        else n.add(p.id);
                        return n;
                      })
                    }
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs text-stone-700 hover:bg-stone-100"
                    aria-pressed={activo}
                  >
                    <span
                      className="flex h-3.5 w-3.5 flex-none items-center justify-center rounded-[3px] border-2"
                      style={{ borderColor: p.color, backgroundColor: activo ? p.color : "transparent" }}
                      aria-hidden
                    >
                      {activo && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{p.id === usuarioId && !planificador ? "Mis visitas" : p.nombre}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <label className="mt-2 flex items-center gap-2 px-1.5 text-xs text-stone-500">
          <input type="checkbox" checked={mostrarCanceladas} onChange={(e) => setMostrarCanceladas(e.target.checked)} className="rounded border-stone-300" />
          Mostrar canceladas
        </label>
      </div>

      {planificador && (
        <div>
          <p className="mb-1.5 flex items-center gap-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            Por programar ({porProgramar.length})
          </p>
          {porProgramar.length === 0 ? (
            <p className="px-1 text-xs text-stone-400">Todos los trámites en ejecución tienen visita pendiente.</p>
          ) : (
            <>
            {porProgramar.length > 5 && (
              <div className="relative mb-1.5">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-stone-400" aria-hidden />
                <input
                  type="search"
                  value={busquedaPendientes}
                  onChange={(e) => setBusquedaPendientes(e.target.value)}
                  placeholder="Buscar trámite…"
                  aria-label="Buscar trámite por programar"
                  className="w-full rounded-md border border-stone-200 bg-white py-1 pl-6 pr-2 text-[11px] focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
                />
              </div>
            )}
            {pendientesFiltrados.length === 0 && <p className="px-1 text-[11px] text-stone-400">Sin coincidencias.</p>}
            <ul className="space-y-1">
              {pendientesFiltrados.slice(0, 50).map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => abrirNueva(dias.includes(hoy) ? hoy : (fecha < hoy ? hoy : fecha), "08:00", e.id)}
                    className="w-full rounded-md border border-dashed border-stone-300 px-2 py-1.5 text-left text-[11px] leading-tight hover:border-cdmb-400 hover:bg-cdmb-50"
                  >
                    <span className="block font-semibold text-stone-800">{e.numero}</span>
                    <span className="block truncate text-stone-500">{e.tramite}</span>
                    {e.asignados.length === 0 && <span className="block text-amber-700">Sin personal asignado</span>}
                  </button>
                </li>
              ))}
            </ul>
            {pendientesFiltrados.length > 50 && (
              <p className="mt-1 px-1 text-[11px] text-stone-400">{pendientesFiltrados.length - 50} más. Refine la búsqueda.</p>
            )}
            </>
          )}
        </div>
      )}
    </div>
  );

  const vistaGrilla = vista === "dia" || vista === "laboral" || vista === "semana";

  return (
    <div className="flex h-[calc(100vh-15rem)] min-h-[560px] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft">
      <aside className="hidden w-60 flex-none border-r border-stone-200 bg-stone-50/70 lg:block">{panelIzquierdo}</aside>

      {panelMovil && (
        <div className="fixed inset-0 z-40 flex lg:hidden" onClick={() => setPanelMovil(false)}>
          <div className="h-full w-72 max-w-[85%] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            {panelIzquierdo}
          </div>
          <div className="flex-1 bg-black/30" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-3 py-2">
          <button
            type="button"
            onClick={() => setPanelMovil(true)}
            className="rounded-md p-1.5 text-stone-600 hover:bg-stone-100 lg:hidden"
            aria-label="Mostrar calendarios"
          >
            <PanelLeft className="h-4 w-4" aria-hidden />
          </button>
          <Link href={enlace(vista, hoy)} className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50">
            Hoy
          </Link>
          <div className="flex items-center">
            <Link href={enlace(vista, desplazarVista(vista, fecha, -1))} aria-label="Anterior" className="rounded-md p-1.5 text-stone-600 hover:bg-stone-100">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Link>
            <Link href={enlace(vista, desplazarVista(vista, fecha, 1))} aria-label="Siguiente" className="rounded-md p-1.5 text-stone-600 hover:bg-stone-100">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <h2 className="order-last w-full truncate text-sm font-semibold text-stone-900 sm:order-none sm:w-auto sm:min-w-0 sm:flex-1 sm:text-base">
            {tituloPeriodo(vista, fecha, dias)}
          </h2>
          <div className="ml-auto flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 sm:ml-0" role="tablist" aria-label="Vista del calendario">
            {VISTAS_CALENDARIO.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={v.id === vista}
                onClick={() => router.push(enlace(v.id, fecha))}
                className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium sm:px-2.5 sm:text-xs ${
                  v.id === vista ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200" : "text-stone-500 hover:text-stone-800"
                } ${v.id === "laboral" || v.id === "semana" ? "hidden md:block" : ""}`}
              >
                {v.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          {vistaGrilla && (
            <>
              <div className={vista === "dia" ? "h-full" : "hidden h-full md:block"}>
                <VistaHoras
                  dias={dias}
                  hoy={hoy}
                  horaActual={horaActual}
                  porDia={porDia}
                  planificador={planificador}
                  onSeleccionar={setSeleccionId}
                  onNueva={abrirNueva}
                />
              </div>
              {vista !== "dia" && (
                <div className="h-full md:hidden">
                  <VistaAgenda dias={dias} hoy={hoy} porDia={porDia} onSeleccionar={setSeleccionId} />
                </div>
              )}
            </>
          )}
          {vista === "mes" && (
            <>
              <div className="hidden h-full md:block">
                <VistaMes fecha={fecha} dias={dias} hoy={hoy} porDia={porDia} planificador={planificador} onSeleccionar={setSeleccionId} onNueva={abrirNueva} />
              </div>
              <div className="h-full md:hidden">
                <VistaAgenda dias={dias.filter((d) => d.slice(0, 7) === fecha.slice(0, 7))} hoy={hoy} porDia={porDia} onSeleccionar={setSeleccionId} />
              </div>
            </>
          )}
          {vista === "agenda" && <VistaAgenda dias={dias} hoy={hoy} porDia={porDia} onSeleccionar={setSeleccionId} />}

          {seleccion && (
            <DetalleVisita
              visita={seleccion}
              planificador={planificador}
              usuarioId={usuarioId}
              onCerrar={() => setSeleccionId(null)}
            />
          )}
        </div>
      </div>

      {nueva && (
        <ModalVisita
          titulo="Nueva visita técnica"
          metodo="POST"
          expedientes={expedientes}
          expedienteInicial={nueva.expedienteId}
          iniciales={{ fecha: nueva.fecha, hora: nueva.hora, horaFin: sumarMinutosHora(nueva.hora, 120), lugar: "", profesionalId: "", observaciones: "" }}
          onCerrar={() => setNueva(null)}
        />
      )}
    </div>
  );
}

function MiniCalendario({ fecha, hoy, vista, diasVisibles }: { fecha: string; hoy: string; vista: VistaCalendario; diasVisibles: string[] }) {
  const [mes, setMes] = useState(`${fecha.slice(0, 7)}-01`);
  const dias = diasDeVista("mes", mes);
  const resaltados = new Set(vista === "mes" || vista === "agenda" ? [fecha] : diasVisibles);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-stone-800">{mayuscula(formato(mes, { month: "long", year: "numeric" }))}</span>
        <span className="flex">
          <button type="button" onClick={() => setMes(sumarMeses(mes, -1))} aria-label="Mes anterior" className="rounded p-0.5 text-stone-500 hover:bg-stone-200">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button type="button" onClick={() => setMes(sumarMeses(mes, 1))} aria-label="Mes siguiente" className="rounded p-0.5 text-stone-500 hover:bg-stone-200">
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px]">
        {SEMANA.map((d) => (
          <span key={d} className="py-0.5 font-medium uppercase text-stone-400">
            {d.charAt(0)}
          </span>
        ))}
        {dias.map((d) => {
          const esHoy = d === hoy;
          const fuera = d.slice(0, 7) !== mes.slice(0, 7);
          return (
            <Link
              key={d}
              href={enlace(vista, d)}
              className={`mx-auto my-px flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                esHoy
                  ? "bg-cdmb-600 font-semibold text-white"
                  : resaltados.has(d)
                    ? "bg-cdmb-100 font-medium text-cdmb-800"
                    : fuera
                      ? "text-stone-300 hover:bg-stone-200"
                      : "text-stone-700 hover:bg-stone-200"
              }`}
            >
              {Number(d.slice(8))}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function BloqueVisita({ v, compacto, onClick }: { v: VisitaCalendario; compacto?: boolean; onClick: () => void }) {
  const cancelada = v.estado === "CANCELADA";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${hora12(v.hora)} – ${hora12(v.horaFin)} · ${v.expediente.numero} · ${v.lugar} · ${v.profesional} · ${ETIQUETA_ESTADO_VISITA[v.estado]}`}
      className={`flex h-full w-full flex-col overflow-hidden rounded-[4px] border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight text-stone-800 transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-cdmb-400 ${
        cancelada ? "opacity-60" : ""
      }`}
      style={{
        borderLeftColor: v.color,
        backgroundColor: `${v.color}26`,
        backgroundImage: cancelada ? "repeating-linear-gradient(135deg, transparent 0 6px, rgba(255,255,255,.7) 6px 9px)" : undefined,
      }}
    >
      <span className={`flex items-center gap-1 font-semibold ${cancelada ? "line-through" : ""}`}>
        {v.estado === "REALIZADA" && <Check className="h-3 w-3 flex-none text-emerald-700" aria-hidden />}
        <span className="truncate">{v.expediente.numero}</span>
      </span>
      {!compacto && (
        <span className="truncate text-stone-500">
          {hora12(v.hora)} – {hora12(v.horaFin)}
        </span>
      )}
      {!compacto && <span className="truncate text-stone-600">{v.lugar}</span>}
      {!compacto && <span className="truncate text-stone-500">{v.profesional}</span>}
    </button>
  );
}

function VistaHoras({
  dias,
  hoy,
  horaActual,
  porDia,
  planificador,
  onSeleccionar,
  onNueva,
}: {
  dias: string[];
  hoy: string;
  horaActual: string;
  porDia: Map<string, VisitaCalendario[]>;
  planificador: boolean;
  onSeleccionar: (id: string) => void;
  onNueva: (dia: string, hora: string) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const [ahora, setAhora] = useState(horaActual);
  const columnas = `56px repeat(${dias.length}, minmax(0, 1fr))`;

  const claveDias = dias.join();
  const primera = Math.min(INICIO_JORNADA, ...dias.flatMap((d) => (porDia.get(d) ?? []).map((v) => Math.floor(v.minutos / 60))));

  useEffect(() => {
    scroll.current?.scrollTo({ top: Math.max(0, primera - 0.5) * HORA_PX });
  }, [claveDias, primera]);

  useEffect(() => {
    const t = setInterval(() => setAhora(partesColombia(new Date()).hora), 60_000);
    return () => clearInterval(t);
  }, []);
  const minutosAhora = Number(ahora.slice(0, 2)) * 60 + Number(ahora.slice(3, 5));

  return (
    <div className="flex h-full flex-col">
      <div className="grid overflow-y-hidden border-b border-stone-200" style={{ gridTemplateColumns: columnas, scrollbarGutter: "stable" }}>
        <div />
        {dias.map((d) => {
          const esHoy = d === hoy;
          return (
            <div key={d} className="border-l border-stone-100 px-2 py-1.5">
              <span className={`block text-[11px] ${esHoy ? "font-semibold text-cdmb-700" : "text-stone-500"}`}>{SEMANA[(fechaUtc(d).getUTCDay() + 6) % 7]}</span>
              <Link
                href={enlace("dia", d)}
                className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-lg leading-none ${
                  esHoy ? "bg-cdmb-600 font-semibold text-white" : "text-stone-800 hover:bg-stone-100"
                }`}
              >
                {Number(d.slice(8))}
              </Link>
            </div>
          );
        })}
      </div>

      <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
        <div className="relative grid" style={{ gridTemplateColumns: columnas, height: 24 * HORA_PX }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) =>
              h === 0 ? null : (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-stone-400" style={{ top: h * HORA_PX }}>
                  {etiquetaHora(h)}
                </span>
              )
            )}
          </div>
          {dias.map((d) => {
            const bloques = ubicarBloques(porDia.get(d) ?? []);
            return (
              <div
                key={d}
                className={`relative border-l border-stone-100 ${planificador ? "cursor-cell" : ""}`}
                style={{
                  backgroundImage: "linear-gradient(#e7e5e4 1px, transparent 1px), linear-gradient(#f5f5f4 1px, transparent 1px)",
                  backgroundSize: `100% ${HORA_PX}px, 100% ${HORA_PX / 2}px`,
                }}
                onClick={(e) => {
                  if (!planificador) return;
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                  const mediaHora = Math.max(0, Math.min(47, Math.floor(y / (HORA_PX / 2))));
                  onNueva(d, `${String(Math.floor(mediaHora / 2)).padStart(2, "0")}:${mediaHora % 2 ? "30" : "00"}`);
                }}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 bg-stone-100/50" style={{ height: INICIO_JORNADA * HORA_PX }} />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-stone-100/50" style={{ top: FIN_JORNADA * HORA_PX }} />
                {bloques.map(({ item: v, columna, columnas: n }) => (
                  <div
                    key={v.id}
                    className="absolute z-10 p-px"
                    style={{
                      top: (v.minutos / 60) * HORA_PX,
                      height: (v.duracion / 60) * HORA_PX,
                      left: `${(columna / n) * 100}%`,
                      width: `${100 / n}%`,
                    }}
                  >
                    <BloqueVisita v={v} compacto={n > 2 || v.duracion < 60} onClick={() => onSeleccionar(v.id)} />
                  </div>
                ))}
                {d === hoy && (
                  <div className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500" style={{ top: (minutosAhora / 60) * HORA_PX }}>
                    <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VistaMes({
  fecha,
  dias,
  hoy,
  porDia,
  planificador,
  onSeleccionar,
  onNueva,
}: {
  fecha: string;
  dias: string[];
  hoy: string;
  porDia: Map<string, VisitaCalendario[]>;
  planificador: boolean;
  onSeleccionar: (id: string) => void;
  onNueva: (dia: string, hora: string) => void;
}) {
  const semanas = dias.length / 7;
  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-stone-200">
        {SEMANA.map((d) => (
          <div key={d} className="border-l border-stone-100 px-2 py-1.5 text-[11px] font-medium text-stone-500 first:border-l-0">
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${semanas}, minmax(0, 1fr))` }}>
        {dias.map((d) => {
          const lista = porDia.get(d) ?? [];
          const fuera = d.slice(0, 7) !== fecha.slice(0, 7);
          const esHoy = d === hoy;
          return (
            <div
              key={d}
              onClick={() => onNueva(d, "08:00")}
              className={`flex min-h-0 flex-col gap-0.5 overflow-hidden border-b border-l border-stone-100 p-1 [&:nth-child(7n+1)]:border-l-0 ${
                fuera ? "bg-stone-50/80" : ""
              } ${planificador ? "cursor-cell" : ""}`}
            >
              <Link
                href={enlace("dia", d)}
                onClick={(e) => e.stopPropagation()}
                className={`mb-0.5 inline-flex h-6 min-w-6 items-center justify-center self-start rounded-full px-1 text-xs ${
                  esHoy ? "bg-cdmb-600 font-semibold text-white" : fuera ? "text-stone-400 hover:bg-stone-100" : "text-stone-700 hover:bg-stone-100"
                }`}
              >
                {Number(d.slice(8)) === 1 ? formato(d, { day: "numeric", month: "short" }) : Number(d.slice(8))}
              </Link>
              {lista.slice(0, 3).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeleccionar(v.id);
                  }}
                  title={`${hora12(v.hora)} · ${v.expediente.numero} · ${v.lugar} · ${v.profesional}`}
                  className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-stone-100 ${v.estado === "CANCELADA" ? "line-through opacity-60" : ""}`}
                >
                  <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: v.color }} aria-hidden />
                  <span className="flex-none text-stone-500">{hora12(v.hora).replace(" ", " ")}</span>
                  <span className="truncate font-medium text-stone-800">{v.expediente.numero}</span>
                </button>
              ))}
              {lista.length > 3 && (
                <Link
                  href={enlace("dia", d)}
                  onClick={(e) => e.stopPropagation()}
                  className="px-1 text-[11px] font-medium text-cdmb-700 hover:underline"
                >
                  {lista.length - 3} más
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VistaAgenda({
  dias,
  hoy,
  porDia,
  onSeleccionar,
}: {
  dias: string[];
  hoy: string;
  porDia: Map<string, VisitaCalendario[]>;
  onSeleccionar: (id: string) => void;
}) {
  const conVisitas = dias.filter((d) => (porDia.get(d) ?? []).length > 0);
  if (conVisitas.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center text-sm text-stone-400">
        <Clock className="h-6 w-6 text-stone-300" aria-hidden />
        Sin visitas en este periodo.
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto">
      {conVisitas.map((d) => (
        <section key={d}>
          <h3 className={`sticky top-0 z-10 border-b border-stone-100 bg-white/95 px-4 py-1.5 text-xs font-semibold backdrop-blur ${d === hoy ? "text-cdmb-700" : "text-stone-600"}`}>
            {d === hoy ? "Hoy · " : ""}
            {mayuscula(formato(d, { weekday: "long", day: "numeric", month: "long" }))}
          </h3>
          <ul>
            {(porDia.get(d) ?? []).map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onSeleccionar(v.id)}
                  className={`flex w-full items-stretch gap-3 px-4 py-2 text-left hover:bg-stone-50 ${v.estado === "CANCELADA" ? "opacity-60" : ""}`}
                >
                  <span className="w-16 flex-none pt-0.5 text-xs text-stone-500">
                    {hora12(v.hora)}
                    <span className="block text-stone-400">{hora12(v.horaFin)}</span>
                  </span>
                  <span className="w-1 flex-none rounded-full" style={{ backgroundColor: v.color }} aria-hidden />
                  <span className="min-w-0 flex-1 text-xs">
                    <span className={`block font-semibold text-stone-900 ${v.estado === "CANCELADA" ? "line-through" : ""}`}>
                      {v.expediente.numero}
                      <span className="ml-1.5 font-normal text-stone-500">{v.expediente.tramite}</span>
                    </span>
                    <span className="flex items-center gap-1 truncate text-stone-600">
                      <MapPin className="h-3 w-3 flex-none" aria-hidden />
                      {v.lugar}
                    </span>
                    <span className="flex items-center gap-1 text-stone-500">
                      <User className="h-3 w-3 flex-none" aria-hidden />
                      {v.profesional}
                    </span>
                  </span>
                  <span className={`h-fit flex-none rounded-full px-2 py-0.5 text-[10px] font-medium ${CLASE_ESTADO_VISITA[v.estado]}`}>
                    {ETIQUETA_ESTADO_VISITA[v.estado]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DetalleVisita({
  visita: v,
  planificador,
  usuarioId,
  onCerrar,
}: {
  visita: VisitaCalendario;
  planificador: boolean;
  usuarioId: string;
  onCerrar: () => void;
}) {
  const editable = v.expediente.enEjecucion && v.estado === "PROGRAMADA";
  return (
    <aside className="absolute inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l border-stone-200 bg-white shadow-2xl">
      <div className="h-1.5 flex-none" style={{ backgroundColor: v.color }} />
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Visita técnica</p>
          <h3 className="truncate text-base font-semibold text-stone-900">{v.expediente.numero}</h3>
          <p className="text-xs text-stone-500">{v.expediente.tramite}</p>
        </div>
        <button type="button" onClick={onCerrar} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600" aria-label="Cerrar">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${CLASE_ESTADO_VISITA[v.estado]}`}>{ETIQUETA_ESTADO_VISITA[v.estado]}</span>
        <dl className="space-y-2.5">
          <div className="flex gap-2.5">
            <Clock className="mt-0.5 h-4 w-4 flex-none text-stone-400" aria-hidden />
            <dd className="text-stone-800">
              {mayuscula(formato(v.dia, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}
              <span className="block text-xs text-stone-500">
                {hora12(v.hora)} – {hora12(v.horaFin)}
              </span>
            </dd>
          </div>
          <div className="flex gap-2.5">
            <MapPin className="mt-0.5 h-4 w-4 flex-none text-stone-400" aria-hidden />
            <dd className="text-stone-800">{v.lugar}</dd>
          </div>
          <div className="flex gap-2.5">
            <User className="mt-0.5 h-4 w-4 flex-none text-stone-400" aria-hidden />
            <dd className="flex items-center gap-1.5 text-stone-800">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: v.color }} aria-hidden />
              {v.profesional}
            </dd>
          </div>
          {(v.observaciones || v.motivoCambio) && (
            <div className="flex gap-2.5">
              <FileText className="mt-0.5 h-4 w-4 flex-none text-stone-400" aria-hidden />
              <dd className="space-y-1 text-xs text-stone-600">
                {v.observaciones && <p>{v.observaciones}</p>}
                {v.motivoCambio && <p>Motivo de cancelación: {v.motivoCambio}</p>}
              </dd>
            </div>
          )}
        </dl>
        <p className="text-[11px] text-stone-400">
          Programó: {v.programadaPor} · {v.expediente.municipio}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-stone-100 px-4 py-3">
        {v.expediente.puedeAbrir && (
          <Link
            href={`/expedientes/${v.expediente.id}#planeador`}
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-cdmb-700 hover:bg-stone-50"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Abrir expediente
          </Link>
        )}
        {v.expediente.puedeAbrir && (v.tieneHoja || (editable && v.puedeRegistrar)) && (
          <Link
            href={`/expedientes/${v.expediente.id}/visitas/${v.id}`}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${
              v.tieneHoja ? "border border-stone-200 bg-white text-cdmb-700 hover:bg-stone-50" : "bg-acento-500 text-white hover:bg-acento-600"
            }`}
          >
            <ClipboardCheck className="h-3 w-3" aria-hidden />
            {v.tieneHoja ? "Ver hoja de visita" : "Registrar visita"}
          </Link>
        )}
        {editable && planificador && (
          <ProgramarVisitaForm
            modo="reprogramar"
            metodo="PATCH"
            endpoint={`/api/visitas-programadas/${v.id}`}
            profesionales={v.expediente.asignados}
            iniciales={{ fecha: v.dia, hora: v.hora, horaFin: v.horaFin, lugar: v.lugar, profesionalId: v.profesionalId, observaciones: v.observaciones ?? "" }}
          />
        )}
        {editable && <AccionesVisita visitaId={v.id} puedeNoRealizada={planificador || usuarioId === v.profesionalId} puedeCancelar={planificador} />}
      </div>
    </aside>
  );
}
