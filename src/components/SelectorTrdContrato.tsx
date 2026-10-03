"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { BuscadorSubserieTRD, type SerieBuscable } from "@/components/BuscadorSubserieTRD";
import { recomendarSubserieContrato } from "@/lib/trd-recomendacion-contrato";

export function SelectorTrdContrato({
  series,
  objeto,
  serieId,
  subserieId,
  onChange,
  autoaplicar = true,
}: {
  series: SerieBuscable[];
  objeto: string;
  serieId: string;
  subserieId: string;
  onChange: (serieId: string, subserieId: string) => void;
  autoaplicar?: boolean;
}) {
  const [manual, setManual] = useState(!autoaplicar);
  const [objetoDiferido, setObjetoDiferido] = useState(objeto);

  useEffect(() => {
    const t = setTimeout(() => setObjetoDiferido(objeto), 400);
    return () => clearTimeout(t);
  }, [objeto]);

  const recomendacion = useMemo(() => recomendarSubserieContrato(objetoDiferido, series), [objetoDiferido, series]);

  useEffect(() => {
    if (manual || !recomendacion) return;
    if (recomendacion.subserieId !== subserieId) onChange(recomendacion.serieId, recomendacion.subserieId);
  }, [manual, recomendacion, subserieId, onChange]);

  const aplicada = recomendacion && recomendacion.subserieId === subserieId;

  return (
    <div className="space-y-2.5">
      {recomendacion ? (
        <div className={`flex flex-wrap items-start gap-2 rounded-xl border px-3 py-2 text-xs ${aplicada ? "border-cdmb-100 bg-cdmb-50/60 text-cdmb-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
          <span className="min-w-0 flex-1">
            Sugerida: <strong>{recomendacion.etiqueta}</strong>, porque {recomendacion.motivo}.{" "}
            {aplicada ? "Puede cambiarla abajo antes de guardar." : "Usted eligió otra clasificación."}
          </span>
          {!aplicada && (
            <button
              type="button"
              onClick={() => {
                setManual(false);
                onChange(recomendacion.serieId, recomendacion.subserieId);
              }}
              className="flex-none font-medium underline hover:no-underline"
            >
              Usar la sugerida
            </button>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-200 px-3 py-2 text-xs text-stone-500">
          {objeto.trim()
            ? "No se reconoce el tipo de contrato en el objeto: elija la clasificación manualmente."
            : "Escriba el objeto del contrato para recibir una sugerencia, o elija la clasificación manualmente."}
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
