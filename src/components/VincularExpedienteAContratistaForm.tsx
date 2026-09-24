"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";

export type ExpedienteVinculable = { id: string; numero: string; objeto: string; etapa: string };

export function VincularExpedienteAContratistaForm({
  contratistaId,
  tieneCuenta,
  opciones,
}: {
  contratistaId: string;
  tieneCuenta: boolean;
  opciones: ExpedienteVinculable[];
}) {
  const router = useRouter();
  const [expedienteId, setExpedienteId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vincular() {
    if (!expedienteId) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contratistaId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo vincular el expediente.");
      setExpedienteId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-stone-500">
        Al vincular un expediente, este contratista podrá consultarlo — incluidas las etapas Contractual y Postcontractual — y cargar en él sus documentos.
        {!tieneCuenta && " Todavía no tiene cuenta de acceso: podrá verlo cuando se le asigne desde Usuarios."}
      </p>
      {opciones.length === 0 ? (
        <p className="text-xs text-stone-400">No hay expedientes sin contratista para vincular.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={expedienteId}
            onChange={(e) => setExpedienteId(e.target.value)}
            className="min-w-0 max-w-full flex-1 rounded-md border border-stone-200 px-2 py-1.5 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            aria-label="Expediente a vincular"
          >
            <option value="">Seleccione un expediente…</option>
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.numero} — {o.objeto.slice(0, 70)}{o.objeto.length > 70 ? "…" : ""} ({o.etapa})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={vincular}
            disabled={!expedienteId || guardando}
            className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            {guardando ? "Vinculando…" : "Vincular"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
