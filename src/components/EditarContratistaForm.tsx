"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CamposPersona } from "@/components/CamposPersona";
import { TIPOS_IDENTIFICACION_USUARIO, type DatosPersona } from "@/lib/datos-persona";

export function EditarContratistaForm({ usuarioId, persona: inicial }: { usuarioId: string; persona: DatosPersona }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [persona, setPersona] = useState<DatosPersona>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch(`/api/contratacion/personas/${usuarioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudieron guardar los datos.");
      const faltan = body.faltantes as string[];
      setAviso(faltan.length > 0 ? `Guardado. Para iniciar un contrato aún faltan: ${faltan.join(", ")}.` : "Datos guardados.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="mt-3 text-xs font-medium text-cdmb-700 hover:underline">
        Editar datos personales
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3 border-t border-stone-100 pt-4">
      <CamposPersona
        valor={persona}
        onChange={setPersona}
        tiposIdentificacion={TIPOS_IDENTIFICACION_USUARIO}
        tributaria
        requeridos={{ identificacion: true, nombre: true, email: true, direccion: true, ubicacion: true, regimenTributario: true }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar datos"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="text-sm text-stone-500 hover:text-stone-700">
          Cerrar
        </button>
        {error && <span className="text-sm text-red-700">{error}</span>}
        {aviso && <span className="text-sm text-emerald-700">{aviso}</span>}
      </div>
    </div>
  );
}
