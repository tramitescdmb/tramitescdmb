"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { LayoutGrid, Clock, Landmark } from "lucide-react";
import { tiempoEstimadoDias, resumenSinPrefijo } from "@/lib/tramites-data";
import type { Categoria } from "@/lib/tramite-categoria";
import type { TramiteTipo, Flujo, PasoDefinicion } from "@prisma/client";

type FlujoConPasos = Flujo & { pasos: PasoDefinicion[] };
type TramiteConFlujos = TramiteTipo & { flujos: FlujoConPasos[] };
type Conteo = { activos: number; aprobados: number; negados: number };

/**
 * Un componente de ícono (función) no se puede pasar como prop de un Server
 * Component a este Client Component — solo datos planos y elementos ya
 * renderizados. `page.tsx` resuelve `<cat.Icono .../>` a JSX ANTES de pasarlo aquí.
 */
type CategoriaParaCliente = {
  id: string;
  etiqueta: string;
  clases: Categoria["clases"];
  iconoGrande: ReactNode;
  iconoChico: ReactNode;
};

/** Una tarjeta del catálogo — normalmente un trámite completo, salvo el caso "PR21" (ver tramites/page.tsx). */
export type EntradaCatalogo = {
  key: string;
  tramite: TramiteConFlujos;
  nombre: string;
  suits: string[];
  flujoParaTiempo: FlujoConPasos | undefined;
  conteo: Conteo | undefined;
  flujoCodigoFoco?: string;
};

/**
 * Catálogo interactivo: las píldoras de categoría son filtros reales (no
 * anclas a una lista que repetía lo mismo debajo) — al hacer clic se queda
 * viendo solo esa categoría. Antes había una fila de píldoras Y, justo
 * debajo, una lista de encabezados con el mismo ícono/nombre/cantidad
 * repetido para cada categoría — se sentía duplicado. Ahora, sin filtro
 * activo, las categorías se separan con un rótulo de texto simple (sin
 * caja, sin ícono repetido) en vez de otra fila de insignias.
 */
function coincideBusqueda(entrada: EntradaCatalogo, termino: string) {
  const t = termino.toLowerCase();
  return (
    entrada.nombre.toLowerCase().includes(t) ||
    entrada.tramite.codigo.toLowerCase().includes(t) ||
    entrada.suits.some((s) => s.toLowerCase().includes(t))
  );
}

export function CatalogoTramites({ secciones }: { secciones: { cat: CategoriaParaCliente; items: EntradaCatalogo[] }[] }) {
  const [filtro, setFiltro] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const totalTramites = secciones.reduce((acc, s) => acc + s.items.length, 0);

  const buscando = busqueda.trim().length > 0;
  const porCategoria = filtro ? secciones.filter((s) => s.cat.id === filtro) : secciones;
  const visibles = buscando
    ? porCategoria.map((s) => ({ ...s, items: s.items.filter((e) => coincideBusqueda(e, busqueda)) })).filter((s) => s.items.length > 0)
    : porCategoria;
  const totalVisible = visibles.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <svg viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden>
          <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M18 18l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, código o ficha SUIT…"
          className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-stone-800 placeholder:text-stone-400 transition-shadow focus:border-cdmb-500 focus:outline-none focus:ring-4 focus:ring-cdmb-500/15"
        />
      </div>

      {/*
        Píldoras de categoría — mismo lenguaje que las insignias de estado
        (EstadoBadge): fondo e ícono en el tinte suave de la categoría
        (`cat.clases.badge`), nunca la píldora sólida de antes (bloque de
        ícono con capa negra encima, muy distinta al resto de la app). El
        color sigue distinguiendo cada categoría — solo cambia cómo se
        presenta — y la seleccionada se marca con borde de 2px en el mismo
        matiz (`cat.clases.borde`), no con un contorno negro genérico.
      */}
      <nav
        className="flex flex-wrap gap-2"
        aria-label="Filtrar por categoría"
      >
        <button
          type="button"
          onClick={() => setFiltro(null)}
          aria-pressed={filtro === null}
          className={`inline-flex items-center gap-2 rounded-full py-1.5 pl-2 pr-3.5 text-left transition active:scale-[0.97] ${
            filtro === null
              ? "border-2 border-graphite-800 bg-graphite-50"
              : "border border-stone-200 bg-white hover:border-stone-300 hover:shadow-soft"
          }`}
        >
          <span
            className={`flex h-7 w-7 flex-none items-center justify-center rounded-full ${
              filtro === null ? "bg-graphite-800 text-white" : "bg-stone-100 text-stone-500"
            }`}
            aria-hidden
          >
            <LayoutGrid className="h-[17px] w-[17px]" />
          </span>
          <span className={`text-sm font-medium ${filtro === null ? "text-graphite-900" : "text-stone-700"}`}>
            Todas <span className={filtro === null ? "font-normal text-graphite-500" : "font-normal text-stone-400"}>({totalTramites})</span>
          </span>
        </button>

        {secciones.map(({ cat, items }) => {
          const activo = filtro === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFiltro(activo ? null : cat.id)}
              aria-pressed={activo}
              title={cat.etiqueta}
              className={`inline-flex items-center gap-2 rounded-full py-1.5 pl-2 pr-3.5 text-left transition active:scale-[0.97] ${
                activo ? `border-2 ${cat.clases.borde} ${cat.clases.badge}` : "border border-stone-200 bg-white hover:border-stone-300 hover:shadow-soft"
              }`}
            >
              <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full ${activo ? cat.clases.icono : cat.clases.badge}`} aria-hidden>
                {cat.iconoChico}
              </span>
              <span className={`text-sm font-medium ${activo ? "" : "text-stone-700"}`}>
                {cat.etiqueta} <span className={`font-normal ${activo ? "opacity-70" : "text-stone-400"}`}>({items.length})</span>
              </span>
            </button>
          );
        })}
      </nav>

      {buscando && (
        <p className="text-sm text-stone-500">
          {totalVisible === 0 ? "Ningún trámite coincide con la búsqueda." : `${totalVisible} trámite${totalVisible === 1 ? "" : "s"} encontrado${totalVisible === 1 ? "" : "s"}.`}
        </p>
      )}

      {totalVisible === 0 && buscando ? (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500 shadow-soft">
          Ningún trámite coincide con &quot;{busqueda}&quot;.
        </div>
      ) : (
        <div className="space-y-8">
          {visibles.map(({ cat, items }) => (
            <div key={cat.id}>
              {filtro === cat.id && !buscando && (
                <div className="mb-4 flex items-center gap-3 border-b border-stone-200 pb-3">
                  <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${cat.clases.icono}`} aria-hidden>
                    {cat.iconoGrande}
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-stone-900">{cat.etiqueta}</h2>
                    <p className="text-xs text-stone-500">
                      {items.length} {items.length === 1 ? "trámite" : "trámites"} en esta categoría
                    </p>
                  </div>
                </div>
              )}
              {filtro === null && !buscando && (
                <div className="mb-3 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 flex-none rounded-full ${cat.clases.pildora}`} aria-hidden />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">{cat.etiqueta}</h2>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((entrada) => (
                  <TarjetaTramite key={entrada.key} entrada={entrada} categoria={cat} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaTramite({ entrada, categoria }: { entrada: EntradaCatalogo; categoria: CategoriaParaCliente }) {
  const { tramite: t, nombre, suits, flujoParaTiempo, conteo, flujoCodigoFoco } = entrada;
  const tiempo = flujoParaTiempo ? tiempoEstimadoDias(flujoParaTiempo.pasos) : null;
  const href = flujoCodigoFoco ? `/tramites/${t.slug}?flujo=${flujoCodigoFoco}` : `/tramites/${t.slug}`;
  const resumenBase = flujoParaTiempo?.resumen ?? t.resumen ?? t.objeto;
  const descripcion = resumenSinPrefijo(resumenBase);

  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white p-4 pt-5 shadow-soft transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-soft-lg active:translate-y-0 active:scale-[0.98] active:shadow-soft"
    >
      <span className={`absolute inset-x-0 top-0 h-1.5 ${categoria.clases.barra}`} aria-hidden />

      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-500">
          {t.codigo} · v{t.version}
        </span>
        {tiempo &&
          (tiempo.total > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500">
              <Clock className="h-3 w-3" aria-hidden />
              ~{tiempo.total} días
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-xs text-stone-400"
              title="El procedimiento oficial no especifica tiempos por actividad"
            >
              <Clock className="h-3 w-3" aria-hidden />
              sin tiempo especificado
            </span>
          ))}
      </div>

      <div className="mb-2 flex items-start gap-3">
        <span
          className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${categoria.clases.icono}`}
          title={categoria.etiqueta}
          aria-hidden
        >
          {categoria.iconoGrande}
        </span>
        <div className="min-w-0">
          <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${categoria.clases.badge}`}>
            {categoria.etiqueta}
          </span>
          <h3 className="mt-1 font-semibold leading-snug text-stone-900 transition group-hover:text-cdmb-700">{nombre}</h3>
        </div>
      </div>

      {suits.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {suits.map((numero) => (
            <span
              key={numero}
              className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500"
              title={`Inscrito en el SUIT (Sistema Único de Información de Trámites), ficha ${numero}. El enlace a la ficha oficial está disponible dentro del trámite.`}
            >
              <Landmark className="h-3 w-3" aria-hidden />
              SUIT {numero}
            </span>
          ))}
        </div>
      )}

      <p className="flex-1 text-sm text-stone-500">{descripcion}</p>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-stone-100 pt-3">
        {!conteo && <span className="text-xs text-stone-400">Sin expedientes todavía</span>}
        {conteo && conteo.activos > 0 && <CountPill color="amber" value={conteo.activos} label="activo" />}
        {conteo && conteo.aprobados > 0 && <CountPill color="emerald" value={conteo.aprobados} label="aprobado" />}
        {conteo && conteo.negados > 0 && <CountPill color="red" value={conteo.negados} label="negado" />}
      </div>
    </Link>
  );
}

/** Mismo lenguaje que EstadoBadge: tinte suave + anillo + punto — nunca solo relleno sólido. */
function CountPill({ value, label, color }: { value: number; label: string; color: "amber" | "emerald" | "red" }) {
  const estilo = {
    amber: { chip: "bg-amber-50 text-amber-700 ring-amber-600/20", punto: "bg-amber-500" },
    emerald: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", punto: "bg-emerald-500" },
    red: { chip: "bg-red-50 text-red-700 ring-red-600/20", punto: "bg-red-500" },
  }[color];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${estilo.chip}`}>
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${estilo.punto}`} aria-hidden />
      {value} {label}
      {value === 1 ? "" : "s"}
    </span>
  );
}
