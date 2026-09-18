"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";

/** Ajusta el número de contrato real y las fechas de inicio/fin — pedido explícito del usuario
 * (2026-09-18): las fechas deben poder corregirse tras crear el expediente para que coincidan con
 * la fecha real del Acta de Inicio, y el número de contrato (SECOP II) a menudo no se conoce
 * todavía al abrir el expediente en Precontractual. */
export function EditarDatosContratoForm({
  expedienteId,
  numeroContratoActual,
  fechaInicioActual,
  fechaFinEstimadaActual,
}: {
  expedienteId: string;
  numeroContratoActual: string | null;
  fechaInicioActual: string | null;
  fechaFinEstimadaActual: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [numeroContrato, setNumeroContrato] = useState(numeroContratoActual ?? "");
  const [fechaInicio, setFechaInicio] = useState(fechaInicioActual ?? "");
  const [fechaFinEstimada, setFechaFinEstimada] = useState(fechaFinEstimadaActual ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numeroContrato: numeroContrato.trim() || null,
          fechaInicio: fechaInicio || null,
          fechaFinEstimada: fechaFinEstimada || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo guardar.");
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Editar número de contrato y fechas"
        className="inline-flex items-center gap-1 text-stone-400 hover:text-stone-600"
      >
        <Pencil className="h-3 w-3" aria-hidden />
      </button>

      {abierto && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Número de contrato y fechas</h3>
              <button type="button" onClick={() => setAbierto(false)} className="text-stone-400 hover:text-stone-600">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <label className="block text-xs font-medium text-stone-600">
              Número de contrato
              <input
                value={numeroContrato}
                onChange={(e) => setNumeroContrato(e.target.value)}
                placeholder="Ej. 045-2026"
                className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-stone-600">
                Fecha de inicio
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-stone-600">
                Fin estimado
                <input
                  type="date"
                  value={fechaFinEstimada}
                  onChange={(e) => setFechaFinEstimada(e.target.value)}
                  className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-stone-400">Útil para ajustar la fecha de inicio a la del Acta de Inicio real.</p>

            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="mt-3 w-full rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
