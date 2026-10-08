"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@/components/Spinner";
import { CamposPersona } from "@/components/CamposPersona";
import { personaVacia, TIPOS_IDENTIFICACION_USUARIO, type DatosPersona } from "@/lib/datos-persona";

export function NuevoSolicitanteForm() {
  const router = useRouter();
  const [persona, setPersona] = useState<DatosPersona>(personaVacia());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<{ texto: string; idExistente?: string } | null>(null);

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch("/api/solicitantes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setError({ texto: "Ya existe un solicitante registrado con esta identificación.", idExistente: data.id });
        return;
      }
      if (!res.ok) throw new Error(data.error || "No se pudo crear el solicitante.");
      router.push(`/solicitantes/${data.id}`);
    } catch (err) {
      setError({ texto: err instanceof Error ? err.message : "Ocurrió un error inesperado. Intente nuevamente." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-soft">
      <CamposPersona
        valor={persona}
        onChange={setPersona}
        tiposIdentificacion={TIPOS_IDENTIFICACION_USUARIO}
        tributaria
        requeridos={{ identificacion: true, nombre: true, ubicacion: true }}
      />

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.texto}
          {error.idExistente && (
            <>
              {" "}
              <Link href={`/solicitantes/${error.idExistente}`} className="font-medium underline">
                Ver el registro existente →
              </Link>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-stone-100 pt-4">
        <Link href="/solicitantes" className="text-sm text-stone-500 hover:text-stone-700">
          Cancelar
        </Link>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="flex items-center gap-2 rounded-md bg-acento-500 px-5 py-2 text-sm font-medium text-white transition-transform hover:bg-acento-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
        >
          {guardando && <Spinner claro />}
          {guardando ? "Guardando…" : "Crear solicitante"}
        </button>
      </div>
    </div>
  );
}
