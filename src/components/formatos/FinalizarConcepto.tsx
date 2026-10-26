"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, X } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import { documentoAPdf } from "@/lib/pdf-desde-documento";
import { sha256Hex, subirArchivoDirecto } from "@/lib/uploads-client";

export function FinalizarConcepto({
  visitaId,
  expedienteId,
  numero,
  firmantes,
}: {
  visitaId: string;
  expedienteId: string;
  numero: string;
  firmantes: { nombre: string; rol: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function finalizar() {
    setError(null);
    try {
      const raiz = document.querySelector<HTMLElement>(".documento-formato");
      if (!raiz) throw new Error("No se encontró el documento en la página.");
      setPaso("Generando el PDF…");
      const bytes = await documentoAPdf(raiz, `Concepto técnico ${numero}`);
      const archivo = new File([bytes as BlobPart], `Concepto-tecnico-${numero}.pdf`, { type: "application/pdf" });
      setPaso("Subiendo el PDF…");
      const [subida, hash] = await Promise.all([subirArchivoDirecto(expedienteId, archivo), sha256Hex(archivo)]);
      setPaso("Enviando a firma…");
      const res = await fetch(`/api/visitas-programadas/${visitaId}/finalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: subida.path, tamanoBytes: subida.tamanoBytes, hashSha256: hash }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo finalizar el concepto.");
      setAbierto(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error inesperado.");
    } finally {
      setPaso(null);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-2 text-sm font-medium text-white hover:bg-acento-600">
        <Send className="h-3.5 w-3.5" aria-hidden />
        Aprobar y enviar a firma
      </button>
      {abierto && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Concepto técnico {numero}</h3>
              <button type="button" onClick={() => setAbierto(false)} disabled={Boolean(paso)} className="text-stone-400 hover:text-stone-600" aria-label="Cerrar">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="text-sm text-stone-700">El concepto queda en versión final: se guarda como PDF en el expediente y ya no admite cambios. Recibirán la solicitud de firma electrónica:</p>
            <ul className="mt-2 space-y-1 rounded-md border border-stone-100 p-2 text-sm">
              {firmantes.map((f, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{f.nombre}</span>
                  <span className="text-xs text-stone-500">{f.rol}</span>
                </li>
              ))}
            </ul>
            {error && <p className="mt-2 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAbierto(false)} disabled={Boolean(paso)} className="rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
                Cancelar
              </button>
              <button type="button" onClick={finalizar} disabled={Boolean(paso)} className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60">
                {paso && <Spinner claro />}
                {paso ?? "Finalizar y enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
