"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CamposPersona } from "@/components/CamposPersona";
import { personaVacia, type DatosPersona } from "@/lib/datos-persona";

export function TerceroForm({ terceroId, inicial }: { terceroId?: string; inicial?: DatosPersona }) {
  const router = useRouter();
  const [persona, setPersona] = useState<DatosPersona>(inicial ?? personaVacia());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<{ texto: string; id?: string } | null>(null);
  const [ok, setOk] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch(terceroId ? `/api/correspondencia/terceros/${terceroId}` : "/api/correspondencia/terceros", {
        method: terceroId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ texto: body.error || "No se pudo guardar.", id: typeof body.id === "string" ? body.id : undefined });
        return;
      }
      if (terceroId) {
        setOk(true);
        router.refresh();
      } else {
        router.push(`/correspondencia/terceros/${body.id}`);
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-soft">
      <CamposPersona valor={persona} onChange={setPersona} identificacionBloqueada={Boolean(terceroId)} requeridos={{ identificacion: true, nombre: true }} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
        <span className="text-sm">
          {error && (
            <span className="text-red-700">
              {error.texto}{" "}
              {error.id && (
                <Link href={`/correspondencia/terceros/${error.id}`} className="font-medium underline">
                  Ver el registro existente
                </Link>
              )}
            </span>
          )}
          {ok && <span className="text-emerald-700">Datos guardados.</span>}
        </span>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-md bg-acento-500 px-5 py-2 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : terceroId ? "Guardar cambios" : "Registrar tercero"}
        </button>
      </div>
    </div>
  );
}
