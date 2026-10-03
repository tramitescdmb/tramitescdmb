"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { BuscadorSubserieTRD, type SerieBuscable } from "@/components/BuscadorSubserieTRD";

export function SelectorTrdContrato({
  series,
  subseriePorModalidad,
  modalidad,
  modalidadEtiqueta,
  serieId,
  subserieId,
  onChange,
  autoaplicar = true,
}: {
  series: SerieBuscable[];
  subseriePorModalidad: Record<string, string>;
  modalidad: string;
  modalidadEtiqueta: string;
  serieId: string;
  subserieId: string;
  onChange: (serieId: string, subserieId: string) => void;
  autoaplicar?: boolean;
}) {
  const [manual, setManual] = useState(!autoaplicar);
  const [modalidadPrevia, setModalidadPrevia] = useState(modalidad);

  if (modalidad !== modalidadPrevia) {
    setModalidadPrevia(modalidad);
    setManual(false);
  }

  const sugerida = useMemo(() => {
    const id = subseriePorModalidad[modalidad];
    if (!id) return null;
    const serie = series.find((s) => s.subseries.some((ss) => ss.id === id));
    const sub = serie?.subseries.find((ss) => ss.id === id);
    return serie && sub ? { serieId: serie.id, subserieId: sub.id, etiqueta: `${serie.dependenciaNombre ?? ""} · ${sub.codigo} — ${sub.nombre}` } : null;
  }, [subseriePorModalidad, modalidad, series]);

  useEffect(() => {
    if (manual || !sugerida) return;
    if (sugerida.subserieId !== subserieId) onChange(sugerida.serieId, sugerida.subserieId);
  }, [manual, sugerida, subserieId, onChange]);

  const aplicada = sugerida && sugerida.subserieId === subserieId;

  return (
    <div className="space-y-2.5">
      {sugerida ? (
        <div className={`flex flex-wrap items-start gap-2 rounded-xl border px-3 py-2 text-xs ${aplicada ? "border-cdmb-100 bg-cdmb-50/60 text-cdmb-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
          <span className="min-w-0 flex-1">
            Según la modalidad <strong>{modalidadEtiqueta}</strong>: <strong>{sugerida.etiqueta}</strong>.{" "}
            {aplicada ? "Puede cambiarla abajo antes de guardar." : "Usted eligió otra clasificación."}
          </span>
          {!aplicada && (
            <button
              type="button"
              onClick={() => {
                setManual(false);
                onChange(sugerida.serieId, sugerida.subserieId);
              }}
              className="flex-none font-medium underline hover:no-underline"
            >
              Usar la de la modalidad
            </button>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-200 px-3 py-2 text-xs text-stone-500">
          La modalidad {modalidadEtiqueta} todavía no tiene subserie asignada en Clasificación TRD: elíjala manualmente.
        </p>
      )}
      <BuscadorSubserieTRD
        series={series}
        serieId={serieId}
        subserieId={subserieId}
        onChange={(s, ss) => {
          setManual(true);
          onChange(s, ss);
        }}
      />
    </div>
  );
}
