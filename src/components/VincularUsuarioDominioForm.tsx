"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCog, Link2, X } from "lucide-react";

export function VincularUsuarioDominioForm({
  contratistaId,
  usuarioActual,
}: {
  contratistaId: string;
  usuarioActual: { nombre: string; email: string } | null;
}) {
  const router = useRouter();
  const [usuarioRed, setUsuarioRed] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vincular() {
    if (!usuarioRed.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/contratistas/${contratistaId}/usuario-dominio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioRed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo vincular el usuario de dominio.");
      setUsuarioRed("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  async function quitar() {
    if (!window.confirm("¿Quitar el vínculo con este usuario de dominio? La cuenta no se borra ni se desactiva, solo deja de asociarse a este contratista.")) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/contratistas/${contratistaId}/usuario-dominio`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo quitar el vínculo.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  if (usuarioActual) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-cdmb-50 px-3 py-1.5 text-xs font-medium text-cdmb-800">
          <UserCog className="h-3.5 w-3.5" aria-hidden />
          {usuarioActual.nombre} ({usuarioActual.email})
        </span>
        <button
          type="button"
          onClick={quitar}
          disabled={guardando}
          title="Quitar el vínculo (no borra la cuenta)"
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-red-700 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Quitar vínculo
        </button>
        {error && <p className="w-full text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={usuarioRed}
        onChange={(e) => setUsuarioRed(e.target.value)}
        placeholder="Usuario de red (ej. jperez)"
        onKeyDown={(e) => e.key === "Enter" && vincular()}
        className="w-48 rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
      />
      <button
        type="button"
        onClick={vincular}
        disabled={guardando || !usuarioRed.trim()}
        className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
      >
        <Link2 className="h-3.5 w-3.5" aria-hidden />
        {guardando ? "Vinculando…" : "Vincular"}
      </button>
      {error && <p className="w-full text-xs text-red-700">{error}</p>}
    </div>
  );
}
