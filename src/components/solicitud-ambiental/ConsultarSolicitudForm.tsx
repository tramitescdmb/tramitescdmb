"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Field, SectionHelp } from "@/components/Field";
import { formatearFechaLarga as fecha } from "@/lib/fecha";

type Resultado = {
  numeroSolicitud: string;
  numeroExpediente: string;
  tramite: string;
  tipoSolicitud: string;
  estado: string;
  explicacion: string;
  etapa: { posicion: number; total: number; titulo: string } | null;
  fechaRadicacion: string;
  fechaUltimoMovimiento: string;
  fechaCierre: string | null;
};

/** Seguimiento de «Solicitud ambiental»: se necesitan la cédula o el NIT Y el número de solicitud. */
export function ConsultarSolicitudForm() {
  const [identificacion, setIdentificacion] = useState("");
  const [numeroSolicitud, setNumeroSolicitud] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResultado(null);
    if (!identificacion.trim() || !numeroSolicitud.trim()) {
      return setError("Indique la cédula o el NIT y el número de solicitud: se necesitan los dos.");
    }
    setBuscando(true);
    try {
      const resp = await fetch("/api/solicitud-ambiental/consultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identificacion: identificacion.trim(), numeroSolicitud: numeroSolicitud.trim() }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "No se pudo consultar.");
      setResultado(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar.");
    } finally {
      setBuscando(false);
    }
  }

  const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";

  return (
    <div className="space-y-4">
      <form onSubmit={consultar} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
        {error && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <SectionHelp>Pedimos los dos datos para que nadie más pueda consultar el estado de su solicitud.</SectionHelp>
        <div className="space-y-3">
          <Field label="Cédula o NIT del solicitante" required help="El documento con el que radicó la solicitud.">
            <input value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} className={inputCls} inputMode="numeric" autoComplete="off" />
          </Field>
          <Field label="Número de solicitud" required help="El número que recibió al radicar, por ejemplo SA-7KQ4-M9XD.">
            <input
              value={numeroSolicitud}
              onChange={(e) => setNumeroSolicitud(e.target.value.toUpperCase())}
              className={`${inputCls} font-mono`}
              placeholder="SA-XXXX-XXXX"
              autoComplete="off"
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={buscando}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60"
        >
          {buscando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
          Consultar
        </button>
      </form>

      {resultado && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
          <p className="font-mono text-sm font-semibold text-cdmb-700">{resultado.numeroSolicitud}</p>
          <p className="mt-1 text-sm text-stone-800">{resultado.tramite}</p>
          {resultado.tipoSolicitud !== resultado.tramite && <p className="text-xs text-stone-500">{resultado.tipoSolicitud}</p>}
          <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] text-stone-400">Estado</dt>
              <dd className="font-medium text-stone-900">{resultado.estado}</dd>
            </div>
            {resultado.etapa && (
              <div>
                <dt className="text-[11px] text-stone-400">
                  Etapa actual ({resultado.etapa.posicion} de {resultado.etapa.total})
                </dt>
                <dd className="text-stone-800">{resultado.etapa.titulo}</dd>
              </div>
            )}
            <div>
              <dt className="text-[11px] text-stone-400">Radicada el</dt>
              <dd className="text-stone-800">{fecha(resultado.fechaRadicacion)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-stone-400">Último movimiento</dt>
              <dd className="text-stone-800">{fecha(resultado.fechaUltimoMovimiento)}</dd>
            </div>
            {resultado.fechaCierre && (
              <div>
                <dt className="text-[11px] text-stone-400">Terminada el</dt>
                <dd className="text-stone-800">{fecha(resultado.fechaCierre)}</dd>
              </div>
            )}
            <div>
              <dt className="text-[11px] text-stone-400">Número de expediente</dt>
              <dd className="font-mono text-stone-800">{resultado.numeroExpediente}</dd>
            </div>
          </dl>
          <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-500">{resultado.explicacion}</p>
        </div>
      )}
    </div>
  );
}
