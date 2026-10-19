"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { CLASE_ESTADO_VISITA, ETIQUETA_ESTADO_VISITA, lunesDe, sumarDias } from "@/lib/planeador";
import type { AgendaLanding } from "@/lib/agenda-landing";

const SEMANA = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

const PUNTO_ESTADO: Record<string, string> = {
  POR_REGISTRAR: "bg-acento-500",
  PROGRAMADA: "bg-sky-500",
  REALIZADA: "bg-emerald-500",
  NO_REALIZADA: "bg-amber-500",
};

const ETIQUETA: Record<string, string> = { ...ETIQUETA_ESTADO_VISITA, POR_REGISTRAR: "Por registrar" };
const CLASE: Record<string, string> = { ...CLASE_ESTADO_VISITA, POR_REGISTRAR: "bg-acento-50 text-acento-700" };

function hora12(hora: string) {
  const h = Number(hora.slice(0, 2));
  return `${h % 12 === 0 ? 12 : h % 12}:${hora.slice(3, 5)} ${h < 12 ? "a. m." : "p. m."}`;
}

function formato(dia: string, opciones: Intl.DateTimeFormatOptions) {
  const t = new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-CO", { ...opciones, timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function MiniPlaneador({ agenda, planificador, titulo = "Mis visitas" }: { agenda: AgendaLanding; planificador: boolean; titulo?: string }) {
  const { hoy, desde, hasta, visitas } = agenda;
  const [lunes, setLunes] = useState(lunesDe(hoy));
  const [dia, setDia] = useState(hoy);

  const porDia = useMemo(() => {
    const m = new Map<string, typeof visitas>();
    for (const v of visitas) m.set(v.dia, [...(m.get(v.dia) ?? []), v]);
    return m;
  }, [visitas]);

  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const estadoDe = (v: { estado: string; dia: string }) => (v.estado === "PROGRAMADA" && v.dia < hoy ? "POR_REGISTRAR" : v.estado);
  const delDia = porDia.get(dia) ?? [];
  const proxima = visitas.find((v) => v.dia > dia && v.estado === "PROGRAMADA");
  const puedeAtras = sumarDias(lunes, -1) >= desde;
  const puedeAdelante = sumarDias(lunes, 7) <= hasta;
  const fin = dias[6]!;
  const rango =
    lunes.slice(0, 7) === fin.slice(0, 7)
      ? `${Number(lunes.slice(8))} – ${formato(fin, { day: "numeric", month: "long" }).toLowerCase()}`
      : `${formato(lunes, { day: "numeric", month: "short" }).toLowerCase()} – ${formato(fin, { day: "numeric", month: "short" }).toLowerCase()}`;

  const mover = (sentido: 1 | -1) => {
    const nuevo = sumarDias(lunes, 7 * sentido);
    setLunes(nuevo);
    setDia(nuevo <= hoy && hoy <= sumarDias(nuevo, 6) ? hoy : nuevo);
  };

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
      <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center text-cdmb-700">
            <CalendarDays className="h-4 w-4" aria-hidden />
          </span>
          {titulo}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setLunes(lunesDe(hoy));
              setDia(hoy);
            }}
            className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            Hoy
          </button>
          <button type="button" disabled={!puedeAtras} onClick={() => mover(-1)} title="Semana anterior" className="rounded-full p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" disabled={!puedeAdelante} onClick={() => mover(1)} title="Semana siguiente" className="rounded-full p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <span className="ml-1 hidden text-xs font-medium text-stone-500 sm:inline">{rango}</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 px-3 pb-3">
        {dias.map((d, i) => {
          const items = porDia.get(d) ?? [];
          const seleccionado = d === dia;
          const esHoy = d === hoy;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDia(d)}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 transition ${seleccionado ? "bg-cdmb-50 ring-1 ring-cdmb-200" : "hover:bg-stone-50"}`}
            >
              <span className={`text-[11px] ${esHoy ? "font-semibold text-cdmb-700" : "text-stone-400"}`}>{SEMANA[i]}</span>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  esHoy ? "bg-cdmb-600 text-white" : d < hoy ? "text-stone-400" : "text-stone-800"
                }`}
              >
                {Number(d.slice(8))}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                {items.slice(0, 3).map((v) => (
                  <span key={v.id} className={`h-1.5 w-1.5 rounded-full ${PUNTO_ESTADO[estadoDe(v)] ?? "bg-stone-300"}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 border-t border-stone-100 px-5 py-3">
        <p className="mb-2 text-xs font-medium text-stone-500">{formato(dia, { weekday: "long", day: "numeric", month: "long" })}</p>
        {delDia.length === 0 ? (
          <div className="py-3 text-sm text-stone-400">
            <p>Sin visitas para este día.</p>
            {proxima && (
              <button
                type="button"
                onClick={() => {
                  setLunes(lunesDe(proxima.dia));
                  setDia(proxima.dia);
                }}
                className="mt-1 text-xs font-medium text-cdmb-700 hover:underline"
              >
                Próxima: {formato(proxima.dia, { weekday: "short", day: "numeric", month: "short" }).toLowerCase()} · {hora12(proxima.hora)}
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {delDia.map((v) => (
              <li key={v.id}>
                <Link href={v.link} className="flex gap-3 rounded-xl border border-stone-100 p-2.5 transition hover:border-cdmb-200 hover:bg-cdmb-50/40">
                  <span className={`w-1 flex-none rounded-full ${PUNTO_ESTADO[estadoDe(v)] ?? "bg-stone-300"}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-stone-800">
                        <Clock className="h-3 w-3 text-stone-400" aria-hidden />
                        {hora12(v.hora)} – {hora12(v.horaFin)}
                      </span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CLASE[estadoDe(v)] ?? ""}`}>
                        {ETIQUETA[estadoDe(v)] ?? v.estado}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-stone-700">
                      {v.numero} · {v.tramite}
                    </span>
                    <span className="flex items-center gap-1 truncate text-xs text-stone-400">
                      <MapPin className="h-3 w-3 flex-none" aria-hidden />
                      <span className="truncate">{v.lugar || v.municipio}</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-stone-100 px-5 py-2.5">
        <Link href={`/planeador?vista=semana&fecha=${dia}`} className="text-xs font-medium text-cdmb-700 hover:underline">
          Abrir planeador
        </Link>
        {planificador && (
          <Link href={`/planeador?vista=dia&fecha=${dia < hoy ? hoy : dia}`} className="inline-flex items-center gap-1 text-xs font-medium text-acento-600 hover:underline">
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
            Programar visita
          </Link>
        )}
      </div>
    </section>
  );
}
