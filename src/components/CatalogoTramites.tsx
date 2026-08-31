"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { tiempoEstimadoDias, resumenSinPrefijo } from "@/lib/tramites-data";
import type { Categoria } from "@/lib/tramite-categoria";
import type { TramiteTipo, Flujo, PasoDefinicion } from "@prisma/client";

type FlujoConPasos = Flujo & { pasos: PasoDefinicion[] };
type TramiteConFlujos = TramiteTipo & { flujos: FlujoConPasos[] };
type Conteo = { activos: number; aprobados: number; negados: number };

/**
 * Un componente de ícono (función) no se puede pasar como prop de un Server
 * Component a este Client Component — solo datos planos y elementos ya
 * renderizados. `page.tsx` resuelve `<cat.Icono .../>` a JSX ANTES de
 * pasarlo aquí, en dos tamaños (el nav usa uno más chico que las tarjetas).
 */
type CategoriaParaCliente = {
  id: string;
  etiqueta: string;
  clases: Categoria["clases"];
  iconoChico: ReactNode;
  iconoGrande: ReactNode;
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
        <svg viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden>
          <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M18 18l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, código o ficha SUIT…"
          className="w-full rounded-lg border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        />
      </div>

      <nav className="flex flex-wrap gap-2.5" aria-label="Filtrar por categoría">
        <button
          type="button"
          onClick={() => setFiltro(null)}
          className={`rounded-full border px-5 py-3 text-sm font-semibold transition active:scale-95 ${
            filtro === null
              ? "border-stone-900 bg-stone-900 text-white shadow-sm"
              : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
          }`}
        >
          Todas <span className="opacity-70">({totalTramites})</span>
        </button>
        {secciones.map(({ cat, items }) => {
          const activo = filtro === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFiltro(activo ? null : cat.id)}
              aria-pressed={activo}
              className={`flex items-center overflow-hidden rounded-full shadow-sm transition active:scale-95 ${
                activo ? "outline outline-2 outline-offset-2 outline-stone-900" : "hover:shadow-md hover:brightness-95"
              } ${cat.clases.pildora}`}
            >
              <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${cat.clases.icono}`}>
                {cat.iconoChico}
              </span>
              <span className="whitespace-nowrap px-3.5 text-sm font-semibold text-white">
                {cat.etiqueta} <span className="font-normal text-white/75">({items.length})</span>
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
      className="group relative flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white p-4 pt-5 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-lg active:translate-y-0 active:scale-[0.98] active:shadow-sm"
    >
      <span className={`absolute inset-x-0 top-0 h-1.5 ${categoria.clases.barra}`} aria-hidden />

      <div className="mb-3 flex items-center justify-between">
        <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-500">
          {t.codigo} · v{t.version}
        </span>
        {tiempo &&
          (tiempo.total > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500">🕒 ~{tiempo.total} días</span>
          ) : (
            <span className="text-xs text-stone-300" title="El procedimiento oficial no especifica tiempos por actividad">
              🕒 sin tiempo especificado
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
          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${categoria.clases.badge}`}>
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
              🏛️ SUIT {numero}
            </span>
          ))}
        </div>
      )}

      <p className="flex-1 text-sm text-stone-500">{descripcion}</p>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-stone-100 pt-3">
        {!conteo && <span className="text-xs text-stone-300">Sin expedientes todavía</span>}
        {conteo && conteo.activos > 0 && <CountPill color="amber" value={conteo.activos} label="activo" />}
        {conteo && conteo.aprobados > 0 && <CountPill color="green" value={conteo.aprobados} label="aprobado" />}
        {conteo && conteo.negados > 0 && <CountPill color="red" value={conteo.negados} label="negado" />}
      </div>
    </Link>
  );
}

function CountPill({ value, label, color }: { value: number; label: string; color: "amber" | "green" | "red" }) {
  const classes = {
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
  }[color];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {value} {label}
      {value === 1 ? "" : "s"}
    </span>
  );
}
