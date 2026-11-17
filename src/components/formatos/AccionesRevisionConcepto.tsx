"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Trash2, Undo2, X } from "lucide-react";
import { Spinner } from "@/components/Spinner";

export function AccionesRevisionConcepto({
  visitaId,
  puedeEnviar,
  puedeDevolver,
  puedeDescartar = false,
}: {
  visitaId: string;
  puedeEnviar: boolean;
  puedeDevolver: boolean;
  /** Descartar un borrador que no se terminará (p. ej. trámite desistido), para poder cerrar el expediente. */
  puedeDescartar?: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"enviar" | "devolver" | "descartar" | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ejecutar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/visitas-programadas/${visitaId}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: modal, comentario }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo completar la acción.");
      setModal(null);
      setComentario("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error inesperado.");
    } finally {
      setEnviando(false);
    }
  }

  if (!puedeEnviar && !puedeDevolver && !puedeDescartar) return null;
  const titulo = modal === "enviar" ? "Enviar el concepto a revisión" : modal === "devolver" ? "Devolver con observaciones" : "Descartar el borrador del concepto";
  const explicacion =
    modal === "enviar"
      ? "Quien planea las visitas recibirá el aviso para revisarlo. Mientras esté en revisión, el concepto no se puede editar."
      : modal === "devolver"
        ? "El concepto vuelve a quien lo elabora, que podrá corregirlo y enviarlo de nuevo a revisión."
        : "El concepto queda en el expediente como descartado, con el motivo, y ya no se podrá editar, revisar ni firmar. Úselo solo si no se va a terminar (por ejemplo, si el trámite se desistió).";
  const motivoObligatorio = modal === "devolver" || modal === "descartar";
  return (
    <>
      {puedeEnviar && (
        <button type="button" onClick={() => setModal("enviar")} className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
          <Send className="h-3.5 w-3.5" aria-hidden />
          Enviar a revisión
        </button>
      )}
      {puedeDevolver && (
        <button type="button" onClick={() => setModal("devolver")} className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100">
          <Undo2 className="h-3.5 w-3.5" aria-hidden />
          Devolver con observaciones
        </button>
      )}
      {puedeDescartar && (
        <button type="button" onClick={() => setModal("descartar")} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Descartar borrador
        </button>
      )}
      {modal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">{titulo}</h3>
              <button type="button" onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-600" aria-label="Cerrar">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="text-sm text-stone-700">{explicacion}</p>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={4}
              maxLength={2000}
              aria-label={modal === "enviar" ? "Nota para quien revisa" : modal === "devolver" ? "Observaciones" : "Motivo del descarte"}
              placeholder={modal === "enviar" ? "Nota para quien revisa (opcional)" : modal === "devolver" ? "Observaciones (obligatorias)" : "Motivo (obligatorio)"}
              className="mt-3 w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-sm"
            />
            {error && <p className="mt-2 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
                Cancelar
              </button>
              <button
                type="button"
                onClick={ejecutar}
                disabled={enviando || (motivoObligatorio && !comentario.trim())}
                className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60"
              >
                {enviando && <Spinner claro />}
                {modal === "enviar" ? "Enviar" : modal === "devolver" ? "Devolver" : "Descartar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
