"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CalendarClock, X, AlertTriangle } from "lucide-react";

type Valores = { fecha: string; hora: string; lugar: string; profesionalId: string; observaciones: string };

export function ProgramarVisitaForm({
  endpoint,
  metodo,
  profesionales,
  iniciales,
  modo,
}: {
  endpoint: string;
  metodo: "POST" | "PATCH";
  profesionales: { id: string; nombre: string }[];
  iniciales: Valores;
  modo: "nueva" | "reprogramar";
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [valores, setValores] = useState<Valores>(iniciales);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cruce, setCruce] = useState(false);

  const campo = (k: keyof Valores) => (e: { target: { value: string } }) => {
    setValores((v) => ({ ...v, [k]: e.target.value }));
    setCruce(false);
  };

  function abrir() {
    setValores(iniciales);
    setError(null);
    setCruce(false);
    setAbierto(true);
  }

  async function guardar(forzar: boolean) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...valores, forzar, ...(metodo === "PATCH" ? { accion: "editar" } : {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCruce(Boolean(body.cruce));
        throw new Error(body.error || "No se pudo guardar.");
      }
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  const claseCampo = "w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";

  return (
    <>
      {modo === "nueva" ? (
        <button
          type="button"
          onClick={abrir}
          className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600"
        >
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
          Programar visita
        </button>
      ) : (
        <button
          type="button"
          onClick={abrir}
          className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
        >
          <CalendarClock className="h-3 w-3" aria-hidden />
          Reprogramar
        </button>
      )}

      {abierto && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              guardar(false);
            }}
            className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 text-left shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">{modo === "nueva" ? "Programar visita técnica" : "Reprogramar visita técnica"}</h3>
              <button type="button" onClick={() => setAbierto(false)} className="text-stone-400 hover:text-stone-600" aria-label="Cerrar">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-stone-700">
                Fecha
                <input type="date" required value={valores.fecha} onChange={campo("fecha")} className={`mt-0.5 ${claseCampo}`} />
              </label>
              <label className="text-xs font-medium text-stone-700">
                Hora
                <input type="time" required value={valores.hora} onChange={campo("hora")} className={`mt-0.5 ${claseCampo}`} />
              </label>
            </div>
            <label className="block text-xs font-medium text-stone-700">
              Lugar
              <input type="text" required maxLength={300} value={valores.lugar} onChange={campo("lugar")} className={`mt-0.5 ${claseCampo}`} />
            </label>
            <label className="block text-xs font-medium text-stone-700">
              Profesional o técnico de evaluación
              <select required value={valores.profesionalId} onChange={campo("profesionalId")} className={`mt-0.5 ${claseCampo}`}>
                <option value="">Seleccione…</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-stone-700">
              Observaciones (opcional)
              <textarea rows={2} value={valores.observaciones} onChange={campo("observaciones")} className={`mt-0.5 ${claseCampo}`} />
            </label>

            {error && (
              <div className={`flex items-start gap-1.5 rounded-md px-2.5 py-2 text-xs ${cruce ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-700"}`}>
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600 disabled:opacity-50"
              >
                {guardando ? "Guardando…" : "Guardar"}
              </button>
              {cruce && (
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => guardar(true)}
                  className="flex-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                >
                  Programar de todas formas
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </>
  );
}
