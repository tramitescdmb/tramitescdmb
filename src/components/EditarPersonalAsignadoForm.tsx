"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, X } from "lucide-react";

export function EditarPersonalAsignadoForm({
  expedienteId,
  personalDisponible,
  asignadosActualesIds,
}: {
  expedienteId: string;
  personalDisponible: { id: string; nombre: string; dependenciaNombre?: string | null }[];
  asignadosActualesIds: string[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set(asignadosActualesIds));
  const [filtro, setFiltro] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = filtro.trim().toLowerCase();
  const filtrados = personalDisponible.filter((s) => seleccion.has(s.id) || (q && s.nombre.toLowerCase().includes(q)));

  function alternar(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalAsignadoIds: Array.from(seleccion) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo guardar.");
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        <UserCheck className="h-3 w-3" aria-hidden />
        Editar personal asignado
      </button>

      {abierto && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Personal de Contratación asignado</h3>
              <button type="button" onClick={() => setAbierto(false)} className="text-stone-400 hover:text-stone-600">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="mb-2 text-xs text-stone-400">
              Solo quien esté marcado aquí podrá ver y gestionar este expediente (además del Jefe y el Administrador de Contratación).
            </p>

            {personalDisponible.length === 0 ? (
              <p className="text-xs text-stone-400">
                No hay ningún usuario con el rol Personal de Contratación — asígnelo primero desde Usuarios y roles.
              </p>
            ) : (
              <>
                <input
                  type="text"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Buscar por nombre…"
                  className="mb-2 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
                />
                {!q && seleccion.size === 0 && <p className="mb-2 text-xs text-stone-400">Escriba un nombre para buscar.</p>}
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {filtrados.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm text-stone-700 hover:bg-stone-50">
                      <input type="checkbox" checked={seleccion.has(s.id)} onChange={() => alternar(s.id)} className="rounded border-stone-300" />
                      {s.nombre}
                      {s.dependenciaNombre && <span className="text-xs text-stone-400">— {s.dependenciaNombre}</span>}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={guardar}
                  disabled={guardando}
                  className="mt-3 w-full rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : "Guardar"}
                </button>
              </>
            )}
            {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
