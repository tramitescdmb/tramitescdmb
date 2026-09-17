"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine, XCircle, Trash2, Pencil } from "lucide-react";

export function FirmarRechazarDocumentoContrato({ documentoId }: { documentoId: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState<"firmar" | "rechazar" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function firmar() {
    setCargando("firmar");
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/documentos/${documentoId}/firmar`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo firmar.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(null);
    }
  }

  async function rechazar() {
    const comentario = window.prompt("Motivo del rechazo:");
    if (comentario === null) return;
    if (!comentario.trim()) return setError("Debe indicar un motivo.");
    setCargando("rechazar");
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/documentos/${documentoId}/rechazar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comentario }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo rechazar.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(null);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={firmar}
        disabled={cargando !== null}
        title="Revisar y aprobar: estampa la firma electrónica"
        className="inline-flex items-center gap-1 rounded-md border border-cdmb-200 bg-cdmb-50 px-2 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-100 disabled:opacity-50"
      >
        <PenLine className="h-3 w-3" aria-hidden />
        {cargando === "firmar" ? "Firmando…" : "Firmar"}
      </button>
      <button
        type="button"
        onClick={rechazar}
        disabled={cargando !== null}
        title="Rechazar este documento (exige motivo)"
        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        <XCircle className="h-3 w-3" aria-hidden />
        Rechazar
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}

/** EXCEPCIÓN deliberada de este módulo: editar/eliminar aquí NO deja ninguna traza en la bitácora del
 * expediente — solo visible/habilitado para Administrador/Jefe de Contratación (el gate real está en
 * el servidor, esto solo evita mostrar el botón a quien de todas formas recibiría 403). */
export function EditarEliminarDocumentoContrato({ documentoId, nombreActual }: { documentoId: string; nombreActual: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function editar() {
    const nombre = window.prompt("Nuevo nombre del documento:", nombreActual);
    if (nombre === null || !nombre.trim()) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/documentos/${documentoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo editar.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  async function eliminar() {
    if (!window.confirm(`¿Eliminar "${nombreActual}"? Esta acción no queda registrada en el historial del expediente.`)) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/documentos/${documentoId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo eliminar.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={editar}
        disabled={cargando}
        title="Editar (Administrador/Jefe de Contratación — sin traza)"
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
      >
        <Pencil className="h-3 w-3" aria-hidden />
      </button>
      <button
        type="button"
        onClick={eliminar}
        disabled={cargando}
        title="Eliminar (Administrador/Jefe de Contratación — sin traza)"
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" aria-hidden />
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
