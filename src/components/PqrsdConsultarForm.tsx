"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Field, SectionHelp } from "@/components/Field";

type Resultado = {
  radicado: string;
  asunto: string;
  estado: string;
  tipo: string | null;
  fechaRadicacion: string;
  fechaVencimiento: string | null;
};

const EXPLICACION_ESTADO: Record<string, string> = {
  "Radicada": "Se recibió y todavía no se ha asignado a nadie para atenderla.",
  "En reparto": "Está pendiente de asignarse a una dependencia o funcionario.",
  "Asignada": "Ya se asignó a quien la va a atender.",
  "En trámite": "Un funcionario la está gestionando.",
  "Se le solicitó información adicional": "La CDMB necesita más información suya para poder continuar. Revise el medio de contacto que indicó.",
  "Respondida": "Ya se le dio respuesta.",
  "Archivada": "Se cerró y quedó guardada.",
  "Anulada": "Se anuló esta solicitud.",
};

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

export function PqrsdConsultarForm() {
  const [radicado, setRadicado] = useState("");
  const [identificacion, setIdentificacion] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function consultar() {
    setError(null);
    setResultado(null);
    if (!radicado.trim() || !identificacion.trim()) {
      return setError("Indique el radicado y la identificación.");
    }
    setBuscando(true);
    try {
      const resp = await fetch("/api/pqrsd/consultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ radicado: radicado.trim(), identificacion: identificacion.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudo consultar.");
      setResultado(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar.");
    } finally {
      setBuscando(false);
    }
  }

  const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <SectionHelp>
          Pedimos los dos datos (no solo el radicado) para que nadie más pueda consultar el estado de su solicitud.
        </SectionHelp>
        <div className="space-y-3">
          <Field label="Radicado" help="El número que le entregamos al radicar, ej. CDMB-R-2026-000123.">
            <input value={radicado} onChange={(e) => setRadicado(e.target.value)} className={inputCls} placeholder="CDMB-R-2026-000123" />
          </Field>
          <Field label="Identificación" help="El mismo documento o NIT con el que radicó la solicitud.">
            <input value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <button
          type="button"
          onClick={consultar}
          disabled={buscando}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-60"
        >
          {buscando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
          Consultar
        </button>
      </div>

      {resultado && (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="font-mono text-sm font-semibold text-cdmb-700">{resultado.radicado}</p>
          <p className="mt-1 text-sm text-stone-700">{resultado.asunto}</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] text-stone-400">Tipo</dt>
              <dd className="text-stone-800">{resultado.tipo ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-stone-400">Estado</dt>
              <dd className="text-stone-800">{resultado.estado}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-stone-400">Radicada el</dt>
              <dd className="text-stone-800">{fecha(resultado.fechaRadicacion)}</dd>
            </div>
            {resultado.fechaVencimiento && (
              <div>
                <dt className="text-[11px] text-stone-400">Fecha estimada de respuesta</dt>
                <dd className="text-stone-800">{fecha(resultado.fechaVencimiento)}</dd>
              </div>
            )}
          </dl>
          {EXPLICACION_ESTADO[resultado.estado] && (
            <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-500">{EXPLICACION_ESTADO[resultado.estado]}</p>
          )}
        </div>
      )}
    </div>
  );
}
