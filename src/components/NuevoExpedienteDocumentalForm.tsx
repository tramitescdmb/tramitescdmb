"use client";

import { useMemo, useState } from "react";
import { Field, SectionHelp } from "@/components/Field";

type Dependencia = { id: string; nombre: string };
type Subserie = { id: string; codigo: string; nombre: string };
type Serie = { id: string; codigo: string; nombre: string; dependenciaId: string | null; subseries: Subserie[] };

const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

export function NuevoExpedienteDocumentalForm({ dependencias, series }: { dependencias: Dependencia[]; series: Serie[] }) {
  const [dependenciaId, setDependenciaId] = useState(dependencias.length === 1 ? dependencias[0]!.id : "");
  const [serieId, setSerieId] = useState("");

  const seriesDeDependencia = useMemo(() => {
    const sinDependencia = series.filter((s) => !s.dependenciaId);
    if (!dependenciaId) return sinDependencia;
    return [...series.filter((s) => s.dependenciaId === dependenciaId), ...sinDependencia];
  }, [series, dependenciaId]);
  const subseries = useMemo(() => seriesDeDependencia.find((s) => s.id === serieId)?.subseries ?? [], [seriesDeDependencia, serieId]);

  return (
    <form action="/api/correspondencia/expedientes" method="post" className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
      <Field label="Asunto" required help="De qué trata este expediente — el nombre con el que se va a identificar.">
        <input name="asunto" required className={inputCls} placeholder='Ej. "Contrato de prestación de servicios No. 045-2026"' />
      </Field>
      <Field label="Descripción" help="Detalle adicional, opcional.">
        <textarea name="descripcion" rows={2} className={inputCls} />
      </Field>

      <div className="border-t border-stone-100 pt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Dependencia y clasificación (TRD)</h3>
        <SectionHelp>
          Elija primero la dependencia dueña del expediente: la serie documental disponible depende de esa área,
          porque la TRD clasifica lo que cada una produce.
        </SectionHelp>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Dependencia" required>
            <select
              name="dependenciaId"
              required
              value={dependenciaId}
              onChange={(e) => { setDependenciaId(e.target.value); setSerieId(""); }}
              className={inputCls}
            >
              <option value="">— Seleccione —</option>
              {dependencias.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
            </select>
          </Field>
          <Field label="Serie documental (TRD)" help="Series propias de la dependencia elegida.">
            <select
              name="serieId"
              value={serieId}
              onChange={(e) => setSerieId(e.target.value)}
              className={inputCls}
              disabled={!dependenciaId}
            >
              <option value="">— Sin clasificar —</option>
              {seriesDeDependencia.map((s) => (<option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>))}
            </select>
          </Field>
          <Field label="Subserie">
            <select name="subserieId" className={inputCls} disabled={!subseries.length}>
              <option value="">{subseries.length ? "— Seleccione —" : "—"}</option>
              {subseries.map((ss) => (<option key={ss.id} value={ss.id}>{ss.codigo} — {ss.nombre}</option>))}
            </select>
          </Field>
        </div>
      </div>

      <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-cdmb-700">
        Abrir expediente
      </button>
    </form>
  );
}
