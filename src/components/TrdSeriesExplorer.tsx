"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

const ETIQUETA_DISPOSICION: Record<string, string> = {
  CONSERVACION_TOTAL: "Conservación total",
  ELIMINACION: "Eliminación",
  SELECCION: "Selección",
  MICROFILMACION_DIGITALIZACION: "Microfilmación / Digitalización",
};

const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";
const DISPOSICIONES = ["CONSERVACION_TOTAL", "ELIMINACION", "SELECCION", "MICROFILMACION_DIGITALIZACION"];

type SubserieVista = {
  id: string;
  codigo: string;
  nombre: string;
  retencionGestionAnios: number;
  retencionCentralAnios: number;
  disposicionesFinal: string[];
};

export type SerieVista = {
  id: string;
  codigo: string;
  nombre: string;
  version: string;
  esAnterior: boolean;
  totalComunicaciones: number;
  subseries: SubserieVista[];
};

export type GrupoVista = { codigo: string; nombre: string; series: SerieVista[] };

function coincide(texto: string, termino: string) {
  return texto.toLowerCase().includes(termino);
}

function serieCoincide(s: SerieVista, termino: string) {
  if (coincide(s.codigo, termino) || coincide(s.nombre, termino)) return true;
  return s.subseries.some((ss) => coincide(ss.codigo, termino) || coincide(ss.nombre, termino));
}

export function TrdSeriesExplorer({ grupos }: { grupos: GrupoVista[] }) {
  const [filtro, setFiltro] = useState("");
  const termino = filtro.trim().toLowerCase();

  const grupoCoincideEnCabecera = (g: GrupoVista) => coincide(g.codigo, termino) || coincide(g.nombre, termino);

  const grupoFiltrados = useMemo(() => {
    if (!termino) return grupos.map((g) => ({ ...g, abiertoPorFiltro: false }));
    return grupos
      .map((g) => {
        const cabeceraCoincide = grupoCoincideEnCabecera(g);
        const series = cabeceraCoincide ? g.series : g.series.filter((s) => serieCoincide(s, termino));
        return { ...g, series, abiertoPorFiltro: series.length > 0 };
      })
      .filter((g) => g.series.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupos, termino]);

  const totalSeries = grupos.reduce((acc, g) => acc + g.series.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar por dependencia, código o nombre de serie/subserie…"
            className={`${inputCls} pl-9`}
            aria-label="Filtrar series y subseries de la TRD"
          />
        </div>
        <span className="whitespace-nowrap text-xs text-stone-400">
          {termino ? `${grupoFiltrados.reduce((a, g) => a + g.series.length, 0)} de ${totalSeries} series` : `${totalSeries} series en ${grupos.length} dependencias`}
        </span>
      </div>

      <p className="text-xs text-stone-400">
        Al agregar una subserie: <strong>Gestión</strong> = años que se guarda en la oficina que la produjo;{" "}
        <strong>Central</strong> = años adicionales en el archivo central después; <strong>Disposición</strong> = qué pasa
        al cumplirse ambos plazos (conservar siempre, eliminar, seleccionar una muestra, o microfilmar/digitalizar).
      </p>

      {grupoFiltrados.length === 0 && (
        <p className="rounded-xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-400">
          {termino ? "Ninguna serie o subserie coincide con ese filtro." : "Aún no hay series documentales. Agregue la primera arriba."}
        </p>
      )}

      {grupoFiltrados.map((g) => (
        <details key={g.codigo || "sin-dependencia"} open={g.abiertoPorFiltro} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <summary className="flex cursor-pointer items-center justify-between gap-2 bg-stone-50 px-4 py-2.5 text-sm font-semibold text-stone-800">
            <span>{g.codigo ? `${g.codigo} — ${g.nombre}` : g.nombre}</span>
            <span className="text-xs font-normal text-stone-400">{g.series.length} serie(s)</span>
          </summary>
          <div className="space-y-3 border-t border-stone-100 p-3">
            {g.series.map((s) => (
              <div key={s.id} className="overflow-hidden rounded-lg border border-stone-200">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 bg-stone-50 px-4 py-2.5">
                  <div>
                    <span className="text-sm font-semibold text-stone-800">{s.codigo} — {s.nombre}</span>
                    <span className="ml-2 text-xs text-stone-400">v{s.version}{s.esAnterior ? " · versión anterior" : ""}</span>
                  </div>
                  <span className="text-xs text-stone-400">{s.subseries.length} subserie(s) · {s.totalComunicaciones} comunicación(es)</span>
                </div>
                {s.subseries.length > 0 && (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-stone-100">
                      {s.subseries.map((ss) => (
                        <tr key={ss.id}>
                          <td className="px-4 py-1.5 font-medium text-stone-600">{ss.codigo}</td>
                          <td className="px-4 py-1.5 text-stone-800">{ss.nombre}</td>
                          <td className="px-4 py-1.5 text-xs text-stone-500">Gestión {ss.retencionGestionAnios}a · Central {ss.retencionCentralAnios}a</td>
                          <td className="px-4 py-1.5 text-xs text-stone-500">
                            {ss.disposicionesFinal.length > 0 ? ss.disposicionesFinal.map((d) => ETIQUETA_DISPOSICION[d]).join(" + ") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <form action="/api/correspondencia/subseries" method="post" className="grid grid-cols-1 gap-2 border-t border-stone-100 p-3 sm:grid-cols-6">
                  <input type="hidden" name="serieId" value={s.id} />
                  <input name="codigo" className={inputCls} placeholder="Cód. subserie" required />
                  <input name="nombre" className={`${inputCls} sm:col-span-2`} placeholder="Nombre de la subserie" required />
                  <input name="retencionGestionAnios" type="number" min={0} className={inputCls} placeholder="Gestión (años)" />
                  <input name="retencionCentralAnios" type="number" min={0} className={inputCls} placeholder="Central (años)" />
                  <fieldset className="sm:col-span-6">
                    <legend className="mb-1 text-[11px] text-stone-500">Disposición final (puede marcar varias a la vez, ej. conservar y además digitalizar)</legend>
                    <div className="flex flex-wrap gap-3">
                      {DISPOSICIONES.map((d) => (
                        <label key={d} className="flex items-center gap-1.5 text-xs text-stone-700">
                          <input type="checkbox" name="disposicionesFinal" value={d} className="rounded border-stone-300" />
                          {ETIQUETA_DISPOSICION[d]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="sm:col-span-6">
                    <button type="submit" className="text-xs font-medium text-cdmb-700 hover:underline">+ Agregar subserie</button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
