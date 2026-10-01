"use client";

import { useEffect, useMemo, useState } from "react";
import { BuscadorDependencia } from "@/components/BuscadorDependencia";

type Subserie = { id: string; codigo: string; nombre: string };
export type SerieBuscable = {
  id: string;
  codigo: string;
  nombre: string;
  dependenciaId?: string | null;
  dependenciaNombre?: string | null;
  subseries: Subserie[];
};

// El código de serie se repite en las 29 dependencias de la CDMB — buscar en una lista plana global
// (como hacía la versión anterior de este componente) es ambiguo: escribir "derechos de petición" trae
// la misma serie repetida una vez por cada dependencia, sin forma de distinguirlas. Por eso ahora son 3
// pasos en cascada (dependencia → serie → subserie), cada uno ya filtrado por el anterior.
export function BuscadorSubserieTRD({
  series,
  serieId,
  subserieId,
  onChange,
  nameSerie,
  nameSubserie,
  dependenciaId,
  dependenciaControlada = false,
  requerido,
}: {
  series: SerieBuscable[];
  serieId?: string;
  subserieId?: string;
  onChange?: (serieId: string, subserieId: string) => void;
  nameSerie?: string;
  nameSubserie?: string;
  // Si el formulario ya tiene su propio campo de dependencia (ej. "Dependencia destino"), páselo acá
  // con dependenciaControlada=true: este componente no muestra un segundo selector de dependencia,
  // solo filtra en vivo por el valor recibido. Sin dependenciaControlada, dependenciaId es apenas una
  // sugerencia inicial y el componente muestra su propio paso de dependencia.
  dependenciaId?: string | null;
  dependenciaControlada?: boolean;
  requerido?: boolean;
}) {
  const dependencias = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const s of series) if (s.dependenciaId) mapa.set(s.dependenciaId, s.dependenciaNombre || s.dependenciaId);
    return [...mapa.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [series]);

  // "Reclasificar" usa este componente sin onChange/serieId/subserieId (lee la selección solo del
  // input oculto al enviar el <form>) — por eso serieId/subserieId siguen siendo estado PROPIO aquí,
  // no derivado, y solo se reemplazan por el valor externo cuando el padre de verdad lo controla
  // (lo pasa, aunque sea como cadena vacía).
  const [serieIdPropio, setSerieIdPropio] = useState(serieId ?? "");
  const [subserieIdPropio, setSubserieIdPropio] = useState(subserieId ?? "");
  const serieIdEfectivo = serieId !== undefined ? serieId : serieIdPropio;
  const subserieIdEfectivo = subserieId !== undefined ? subserieId : subserieIdPropio;

  const serieActual = useMemo(() => series.find((s) => s.id === serieIdEfectivo), [series, serieIdEfectivo]);

  const [dependenciaPropia, setDependenciaPropia] = useState(() => serieActual?.dependenciaId || dependenciaId || "");
  useEffect(() => {
    if (serieActual?.dependenciaId) setDependenciaPropia(serieActual.dependenciaId);
  }, [serieActual]);

  const dependenciaEfectiva = dependenciaControlada ? dependenciaId || "" : dependenciaPropia;

  // En modo controlado, el formulario puede cambiar la dependencia externa (ej. "Dependencia destino")
  // en cualquier momento. Si la serie ya elegida no pertenece a la nueva dependencia, queda huérfana:
  // el chip de Serie deja de mostrarse (no aparece en la lista filtrada) pero serieId/subserieId siguen
  // vivos en el estado del formulario y se enviarían igual al guardar. Hay que limpiarlos.
  useEffect(() => {
    if (!dependenciaControlada) return;
    if (serieActual && serieActual.dependenciaId !== (dependenciaId || "")) onChange?.("", "");
  }, [dependenciaControlada, dependenciaId, serieActual, onChange]);

  const seriesDeDependencia = useMemo(
    () => series.filter((s) => s.dependenciaId === dependenciaEfectiva).map((s) => ({ id: s.id, nombre: `${s.codigo} — ${s.nombre}` })),
    [series, dependenciaEfectiva]
  );
  const subseriesDeSerie = useMemo(
    () => (serieActual?.subseries ?? []).map((ss) => ({ id: ss.id, nombre: `${ss.codigo} — ${ss.nombre}` })),
    [serieActual]
  );

  function elegirDependencia(id: string) {
    setDependenciaPropia(id);
    setSerieIdPropio("");
    setSubserieIdPropio("");
    onChange?.("", "");
  }
  function elegirSerie(id: string) {
    setSerieIdPropio(id);
    setSubserieIdPropio("");
    onChange?.(id, "");
  }
  function elegirSubserie(id: string) {
    setSubserieIdPropio(id);
    onChange?.(serieIdEfectivo, id);
  }

  return (
    <div className="space-y-2.5">
      {nameSerie && <input type="hidden" name={nameSerie} value={serieIdEfectivo} />}
      {nameSubserie && <input type="hidden" name={nameSubserie} value={subserieIdEfectivo} required={requerido} />}

      {!dependenciaControlada && (
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Dependencia</label>
          <BuscadorDependencia dependencias={dependencias} value={dependenciaEfectiva} onChange={elegirDependencia} placeholder="Buscar dependencia…" />
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">Serie</label>
        {dependenciaEfectiva ? (
          <BuscadorDependencia dependencias={seriesDeDependencia} value={serieIdEfectivo} onChange={elegirSerie} placeholder="Buscar serie…" />
        ) : (
          <p className="rounded-md border border-dashed border-stone-200 px-3 py-2 text-xs text-stone-400">
            {dependenciaControlada ? "Elija primero la dependencia arriba." : "Elija primero la dependencia."}
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">Subserie</label>
        {serieIdEfectivo ? (
          <BuscadorDependencia dependencias={subseriesDeSerie} value={subserieIdEfectivo} onChange={elegirSubserie} placeholder="Buscar subserie…" />
        ) : (
          <p className="rounded-md border border-dashed border-stone-200 px-3 py-2 text-xs text-stone-400">Elija primero la serie.</p>
        )}
      </div>
    </div>
  );
}
