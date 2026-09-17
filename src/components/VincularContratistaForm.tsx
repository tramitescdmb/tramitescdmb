"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/** Vincula el contratista de un expediente ya creado — necesario para poder pasar de
 * Precontractual a Contractual (el expediente no puede avanzar sin saber quién es el
 * contratista, persona natural o jurídica). Busca por identificación; si no existe,
 * ofrece crearlo desde el registro de Contratistas. */
export function VincularContratistaForm({ expedienteId }: { expedienteId: string }) {
  const router = useRouter();
  const [identificacion, setIdentificacion] = useState("");
  const [encontrado, setEncontrado] = useState<{ id: string; nombreORazonSocial: string } | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscar() {
    if (!identificacion.trim()) return;
    setBuscando(true);
    setError(null);
    setEncontrado(null);
    try {
      const res = await fetch(`/api/contratacion/contratistas/buscar?identificacion=${encodeURIComponent(identificacion.trim())}`);
      if (res.ok) setEncontrado(await res.json());
      else setError("No hay ningún contratista registrado con esa identificación.");
    } finally {
      setBuscando(false);
    }
  }

  async function vincular() {
    if (!encontrado) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contratistaId: encontrado.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo vincular el contratista.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        value={identificacion}
        onChange={(e) => {
          setIdentificacion(e.target.value);
          setEncontrado(null);
        }}
        placeholder="NIT o cédula del contratista"
        className="w-52 rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
      />
      <button
        type="button"
        onClick={buscar}
        disabled={buscando || !identificacion.trim()}
        className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
      >
        <Search className="h-3 w-3" aria-hidden />
        Buscar
      </button>
      {encontrado && (
        <>
          <span className="text-xs font-medium text-amber-900">{encontrado.nombreORazonSocial}</span>
          <button
            type="button"
            onClick={vincular}
            disabled={guardando}
            className="rounded-md bg-amber-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-900 disabled:opacity-50"
          >
            {guardando ? "Vinculando…" : "Vincular"}
          </button>
        </>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
