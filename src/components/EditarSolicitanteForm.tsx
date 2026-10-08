"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { CamposPersona } from "@/components/CamposPersona";
import { TIPOS_IDENTIFICACION_USUARIO, type DatosPersona } from "@/lib/datos-persona";

export function EditarSolicitanteForm({ solicitanteId, persona: inicial }: { solicitanteId: string; persona: DatosPersona }) {
  const router = useRouter();
  const [persona, setPersona] = useState<DatosPersona>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/solicitantes/${solicitanteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo guardar.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado. Intente nuevamente.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <details className="group mt-3">
      <summary className="cursor-pointer text-xs font-medium text-cdmb-700 [&::-webkit-details-marker]:hidden">Editar información</summary>
      <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
        <CamposPersona
          valor={persona}
          onChange={setPersona}
          tiposIdentificacion={TIPOS_IDENTIFICACION_USUARIO}
          tributaria
          identificacionBloqueada
          requeridos={{ nombre: true, ubicacion: true }}
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="flex items-center gap-2 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60"
        >
          {guardando && <Spinner claro />}
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </details>
  );
}
