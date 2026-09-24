"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { CampoMoneda } from "@/components/CampoMoneda";
import { BuscadorDependencia } from "@/components/BuscadorDependencia";

type ModalidadOpcion = { valor: string; etiqueta: string };
type Dependencia = { id: string; nombre: string };

export function EditarDatosContratoForm({
  expedienteId,
  modalidadActual,
  modalidades,
  valorActual,
  dependenciaActualId,
  dependencias,
  numeroContratoActual,
  fechaInicioActual,
  fechaFinEstimadaActual,
}: {
  expedienteId: string;
  modalidadActual: string;
  modalidades: ModalidadOpcion[];
  valorActual: string | null;
  dependenciaActualId: string;
  dependencias: Dependencia[];
  numeroContratoActual: string | null;
  fechaInicioActual: string | null;
  fechaFinEstimadaActual: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [modalidadSeleccion, setModalidadSeleccion] = useState(modalidadActual);
  const [valor, setValor] = useState(valorActual ?? "");
  const [dependenciaSolicitanteId, setDependenciaSolicitanteId] = useState(dependenciaActualId);
  const [numeroContrato, setNumeroContrato] = useState(numeroContratoActual ?? "");
  const [fechaInicio, setFechaInicio] = useState(fechaInicioActual ?? "");
  const [fechaFinEstimada, setFechaFinEstimada] = useState(fechaFinEstimadaActual ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!dependenciaSolicitanteId) return setError("Debe elegir la dependencia solicitante.");
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modalidadSeleccion,
          valor: valor.trim() || null,
          dependenciaSolicitanteId,
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
        title="Editar modalidad, valor, dependencia, número de contrato y fechas"
        className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        Editar datos generales
      </button>

      {abierto && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Datos generales del expediente</h3>
              <button type="button" onClick={() => setAbierto(false)} className="text-stone-400 hover:text-stone-600">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-stone-600">
                Modalidad de selección
                <select
                  value={modalidadSeleccion}
                  onChange={(e) => setModalidadSeleccion(e.target.value)}
                  className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
                >
                  {modalidades.map((m) => (
                    <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-stone-600">
                Dependencia solicitante
                <div className="mt-1">
                  <BuscadorDependencia dependencias={dependencias} value={dependenciaSolicitanteId} onChange={setDependenciaSolicitanteId} />
                </div>
              </label>

              <label className="block text-xs font-medium text-stone-600">
                Valor del contrato
                <CampoMoneda value={valor} onChange={setValor} className="mt-1" />
              </label>

              <label className="block text-xs font-medium text-stone-600">
                Número de contrato
                <input
                  value={numeroContrato}
                  onChange={(e) => setNumeroContrato(e.target.value)}
                  placeholder="Ej. 045-2026"
                  className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
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
              <p className="text-[11px] text-stone-400">
                Útil para ajustar la fecha de inicio a la del Acta de Inicio real, corregir un dato mal capturado al abrir el
                expediente, o registrar el número de contrato cuando aún no se conocía.
              </p>
            </div>

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
