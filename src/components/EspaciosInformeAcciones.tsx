"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";

const inputCls = "min-w-0 flex-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

export function NuevoEspacioInformeForm({ expedienteId, requisitoId }: { expedienteId: string; requisitoId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear() {
    if (!nombre.trim()) return setError("Escriba el nombre del espacio.");
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}/periodos-eventuales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, requisitoId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo crear el espacio.");
      setNombre("");
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Agregar un espacio eventual
      </button>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md border border-stone-200 bg-stone-50/60 p-2.5">
      <p className="text-[11px] text-stone-500">
        Un espacio adicional a los periodos mensuales, para una eventualidad. Descríbalo con un nombre claro; luego se le carga su documento.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={120}
          placeholder="Ej. Informe extraordinario por suspensión del contrato"
          aria-label="Nombre del espacio"
          className={inputCls}
          onKeyDown={(e) => e.key === "Enter" && crear()}
        />
        <button
          type="button"
          onClick={crear}
          disabled={guardando}
          className="rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
        >
          {guardando ? "Creando…" : "Crear espacio"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="text-xs text-stone-500 hover:text-stone-700">
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function EspacioEventualAcciones({
  expedienteId,
  periodoId,
  nombre,
  tieneDocumento,
}: {
  expedienteId: string;
  periodoId: string;
  nombre: string;
  tieneDocumento: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const url = `/api/contratacion/expedientes/${expedienteId}/periodos-eventuales/${periodoId}`;

  async function llamar(init: RequestInit) {
    setError(null);
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "No se pudo completar la acción.");
      return;
    }
    router.refresh();
  }

  function renombrar() {
    const nuevo = window.prompt("Nuevo nombre del espacio:", nombre);
    if (nuevo === null || !nuevo.trim() || nuevo.trim() === nombre) return;
    void llamar({ method: "PATCH", body: JSON.stringify({ nombre: nuevo }) });
  }

  function quitar() {
    if (!window.confirm(`¿Quitar el espacio «${nombre}»?`)) return;
    void llamar({ method: "DELETE" });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={renombrar} title="Renombrar el espacio" className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">Renombrar</span>
      </button>
      {!tieneDocumento && (
        <button type="button" onClick={quitar} title="Quitar el espacio" className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-700">
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">Quitar</span>
        </button>
      )}
      {error && <span className="text-[11px] text-red-700">{error}</span>}
    </span>
  );
}
