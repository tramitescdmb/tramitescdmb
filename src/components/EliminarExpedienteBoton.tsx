"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

/** Elimina COMPLETAMENTE el expediente (incluso cerrado) — exige escribir el número exacto
 * como confirmación, dado lo irreversible de la acción (documentos, firmas y bitácora del
 * expediente se borran en cascada). Reservado al Administrador de Contratación. */
export function EliminarExpedienteBoton({ expedienteId, numero }: { expedienteId: string; numero: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function eliminar() {
    const escrito = window.prompt(
      `Esta acción borra TODO el expediente ${numero} (documentos, firmas y bitácora) sin poder deshacerse. Escriba el número del expediente para confirmar:`
    );
    if (escrito === null) return;
    if (escrito.trim() !== numero) {
      setError("El número escrito no coincide — no se eliminó nada.");
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo eliminar el expediente.");
      router.push("/contratacion/expedientes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setCargando(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={eliminar}
        disabled={cargando}
        title="Eliminar por completo este expediente, incluso si está cerrado"
        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        {cargando ? "Eliminando…" : "Eliminar expediente"}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
