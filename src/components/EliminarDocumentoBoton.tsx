"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconX } from "@/components/icons";

export function EliminarDocumentoBoton({
  documentoId,
  nombre,
  etapaAbierta,
  puedeEliminar,
}: {
  documentoId: string;
  nombre: string;
  etapaAbierta: boolean;
  puedeEliminar: boolean;
}) {
  const router = useRouter();
  const [eliminando, setEliminando] = useState(false);

  if (!puedeEliminar) return null;

  async function handleClick() {
    let oficio = "";
    if (!etapaAbierta) {
      const respuesta = prompt(
        `"${nombre}" quedó en una etapa que ya se cerró. Para eliminarlo, escribe el número o referencia del oficio de solicitud del Subdirector (obligatorio):`
      );
      if (respuesta === null) return; // canceló el diálogo
      oficio = respuesta.trim();
      if (!oficio) {
        alert("Se necesita el oficio de solicitud del Subdirector para eliminar un documento de una etapa ya cerrada.");
        return;
      }
    } else if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setEliminando(true);
    try {
      const res = await fetch(`/api/documentos/${documentoId}/eliminar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oficio }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo eliminar el documento.");
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      setEliminando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={eliminando}
      title={etapaAbierta ? "Eliminar documento" : "Eliminar documento (requiere oficio — etapa cerrada)"}
      className="flex-none rounded p-1 text-stone-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-60"
    >
      {eliminando ? (
        <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-400 border-t-transparent" />
      ) : (
        <IconX className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
