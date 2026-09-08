"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, CheckSquare, Square, PencilLine, Download, FolderOpen } from "lucide-react";

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
  descripcion: string | null;
  version: string;
  esAnterior: boolean;
  actualizadaEn: string;
  totalComunicaciones: number;
  subseries: SubserieVista[];
};

export type GrupoVista = { codigo: string; nombre: string; series: SerieVista[] };

function coincide(texto: string, termino: string) {
  return texto.toLowerCase().includes(termino);
}

function serieCoincide(s: SerieVista, termino: string) {
  if (coincide(s.codigo, termino) || coincide(s.nombre, termino)) return true;
  if (s.descripcion && coincide(s.descripcion, termino)) return true;
  return s.subseries.some((ss) => coincide(ss.codigo, termino) || coincide(ss.nombre, termino));
}

export function TrdSeriesExplorer({ grupos }: { grupos: GrupoVista[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState("");
  const termino = filtro.trim().toLowerCase();

  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [gestion, setGestion] = useState("");
  const [central, setCentral] = useState("");
  const [cambiarDisposicion, setCambiarDisposicion] = useState(false);
  const [disposicionesNuevas, setDisposicionesNuevas] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<string | null>(null);

  function alternarSeleccion(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function alternarDisposicionNueva(d: string) {
    setDisposicionesNuevas((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  async function aplicarCambioMasivo() {
    if (seleccion.size === 0) return;
    if (!gestion.trim() && !central.trim() && !cambiarDisposicion) {
      setError("Indique al menos un cambio a aplicar: gestión, central, o la disposición final.");
      return;
    }
    setEnviando(true);
    setError(null);
    setResumen(null);
    try {
      const res = await fetch("/api/correspondencia/subseries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subserieIds: Array.from(seleccion),
          ...(gestion.trim() ? { retencionGestionAnios: Number(gestion) } : {}),
          ...(central.trim() ? { retencionCentralAnios: Number(central) } : {}),
          ...(cambiarDisposicion ? { disposicionesFinal: Array.from(disposicionesNuevas) } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo aplicar el cambio.");
      setResumen(`${body.actualizadas} subserie(s) actualizada(s).`);
      setSeleccion(new Set());
      setGestion("");
      setCentral("");
      setCambiarDisposicion(false);
      setDisposicionesNuevas(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setEnviando(false);
    }
  }

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
  const idsVisibles = useMemo(
    () => grupoFiltrados.flatMap((g) => g.series.flatMap((s) => s.subseries.map((ss) => ss.id))),
    [grupoFiltrados]
  );
  const todasVisiblesSeleccionadas = idsVisibles.length > 0 && idsVisibles.every((id) => seleccion.has(id));

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
        {idsVisibles.length > 0 && (
          <button
            type="button"
            onClick={() => setSeleccion(todasVisiblesSeleccionadas ? new Set() : new Set(idsVisibles))}
            className="flex flex-none items-center gap-1.5 whitespace-nowrap text-xs font-medium text-cdmb-700 hover:underline"
          >
            {todasVisiblesSeleccionadas ? <CheckSquare className="h-3.5 w-3.5" aria-hidden /> : <Square className="h-3.5 w-3.5" aria-hidden />}
            {todasVisiblesSeleccionadas ? "Quitar selección" : `Seleccionar las ${idsVisibles.length} visibles`}
          </button>
        )}
      </div>

      <p className="text-xs text-stone-400">
        Al agregar una subserie: <strong>Gestión</strong> = años que se guarda en la oficina que la produjo;{" "}
        <strong>Central</strong> = años adicionales en el archivo central después; <strong>Disposición</strong> = qué pasa
        al cumplirse ambos plazos (conservar siempre, eliminar, seleccionar una muestra, o microfilmar/digitalizar).
        Marque el cuadro de una o varias subseries (incluso de distintas series o dependencias) para editar su
        retención o disposición a todas a la vez.
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
                    <span className="ml-2 text-xs text-stone-400">v{s.version}{s.esAnterior ? " · versión anterior" : ""} · actualizada {s.actualizadaEn}</span>
                    {s.descripcion && <p className="mt-0.5 text-xs text-stone-500">{s.descripcion}</p>}
                  </div>
                  <span className="flex items-center gap-2 text-xs text-stone-400">
                    {s.subseries.length} subserie(s) · {s.totalComunicaciones} comunicación(es)
                    <Link
                      href={`/correspondencia/expedientes?serieId=${s.id}`}
                      title="Ver los expedientes clasificados en esta serie"
                      className="flex items-center gap-1 rounded-md border border-stone-300 px-2 py-1 font-medium text-cdmb-700 hover:bg-stone-50"
                    >
                      <FolderOpen className="h-3 w-3" aria-hidden />
                      Ver expedientes
                    </Link>
                    <a
                      href={`/api/correspondencia/trd/series/${s.id}/exportar`}
                      title="Exportar todo lo clasificado en esta serie (comunicaciones y expedientes)"
                      className="flex items-center gap-1 rounded-md border border-stone-300 px-2 py-1 font-medium text-cdmb-700 hover:bg-stone-50"
                    >
                      <Download className="h-3 w-3" aria-hidden />
                      Exportar contenido
                    </a>
                  </span>
                </div>
                {s.subseries.length > 0 && (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-stone-100">
                      {s.subseries.map((ss) => (
                        <tr key={ss.id} className={seleccion.has(ss.id) ? "bg-cdmb-50/60" : undefined}>
                          <td className="w-8 px-4 py-1.5">
                            <input
                              type="checkbox"
                              checked={seleccion.has(ss.id)}
                              onChange={() => alternarSeleccion(ss.id)}
                              className="rounded border-stone-300"
                              aria-label={`Seleccionar subserie ${ss.codigo}`}
                            />
                          </td>
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

      {seleccion.size > 0 && (
        <div className="sticky bottom-3 z-10 rounded-xl border border-cdmb-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
              <PencilLine className="h-4 w-4 text-cdmb-600" aria-hidden />
              {seleccion.size} subserie(s) seleccionada(s)
            </p>
            <button type="button" onClick={() => setSeleccion(new Set())} className="text-xs text-stone-500 hover:text-cdmb-700 hover:underline">
              Quitar selección
            </button>
          </div>
          <p className="mb-3 text-xs text-stone-400">
            Deje en blanco lo que no quiera cambiar. Se aplica a todas las seleccionadas por igual.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-stone-600">Gestión (años)</span>
              <input type="number" min={0} value={gestion} onChange={(e) => setGestion(e.target.value)} placeholder="Sin cambio" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-stone-600">Central (años)</span>
              <input type="number" min={0} value={central} onChange={(e) => setCentral(e.target.value)} placeholder="Sin cambio" className={inputCls} />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs font-medium text-stone-700">
            <input type="checkbox" checked={cambiarDisposicion} onChange={(e) => setCambiarDisposicion(e.target.checked)} className="rounded border-stone-300" />
            También reemplazar la disposición final de todas las seleccionadas
          </label>
          {cambiarDisposicion && (
            <div className="mt-2 flex flex-wrap gap-3 rounded-md bg-stone-50 p-2.5">
              {DISPOSICIONES.map((d) => (
                <label key={d} className="flex items-center gap-1.5 text-xs text-stone-700">
                  <input type="checkbox" checked={disposicionesNuevas.has(d)} onChange={() => alternarDisposicionNueva(d)} className="rounded border-stone-300" />
                  {ETIQUETA_DISPOSICION[d]}
                </label>
              ))}
            </div>
          )}
          {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
          {resumen && <p className="mt-2 text-xs text-green-700">{resumen}</p>}
          <button
            type="button"
            onClick={aplicarCambioMasivo}
            disabled={enviando}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? "Aplicando…" : `Aplicar a ${seleccion.size} subserie(s)`}
          </button>
        </div>
      )}
    </div>
  );
}
