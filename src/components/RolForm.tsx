"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TramiteOpcion = { id: string; codigo: string; nombre: string };
type GrupoTramites = { etiqueta: string; items: TramiteOpcion[] };

export function RolForm({
  modo,
  rolId,
  valoresIniciales,
  tramitesPorCategoria,
}: {
  modo: "crear" | "editar";
  rolId?: string;
  valoresIniciales: {
    nombre: string;
    descripcion: string;
    todosLosTramites: boolean;
    tramiteIds: string[];
    activo: boolean;
  };
  tramitesPorCategoria: GrupoTramites[];
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(valoresIniciales.nombre);
  const [descripcion, setDescripcion] = useState(valoresIniciales.descripcion);
  const [todosLosTramites, setTodosLosTramites] = useState(valoresIniciales.todosLosTramites);
  const [tramiteIds, setTramiteIds] = useState<Set<string>>(new Set(valoresIniciales.tramiteIds));
  const [activo, setActivo] = useState(valoresIniciales.activo);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function alternarTramite(id: string) {
    setTramiteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setError("Debe indicarse el nombre del rol.");
      return;
    }
    setGuardando(true);
    try {
      const url = modo === "crear" ? "/api/roles" : `/api/roles/${rolId}`;
      const method = modo === "crear" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          todosLosTramites,
          tramiteIds: Array.from(tramiteIds),
          activo,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo guardar el rol.");
      }
      router.push("/roles");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-6">
      <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700">Nombre del rol *</span>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Evaluador de Vertimientos"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
          </label>
          <label className="flex items-end gap-2 pb-2">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-4 w-4 rounded border-stone-300 text-cdmb-600 focus:ring-cdmb-500" />
            <span className="text-sm text-stone-700">Rol activo</span>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">Descripción (opcional)</span>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
        </label>
      </section>

      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Trámites</h2>
          <p className="text-xs text-stone-500">
            Dentro de &quot;Trámites ambientales 2.0&quot;, a cuáles trámites concretos del catálogo tiene acceso
            este rol (catálogo, expedientes y radicación). No afecta a VITAL ni a SINCA 1.0, que quedan
            siempre abiertos.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={todosLosTramites}
            onChange={(e) => setTodosLosTramites(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-cdmb-600 focus:ring-cdmb-500"
          />
          Todos los trámites (sin restricción)
        </label>

        {!todosLosTramites && (
          <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-stone-100 p-3">
            {tramitesPorCategoria.map((grupo) => (
              <details key={grupo.etiqueta} open className="group">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-stone-500 [&::-webkit-details-marker]:hidden">
                  {grupo.etiqueta} ({grupo.items.length})
                </summary>
                <div className="mt-1.5 space-y-1 pl-2">
                  {grupo.items.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm text-stone-700 hover:bg-stone-50">
                      <input
                        type="checkbox"
                        checked={tramiteIds.has(t.id)}
                        onChange={() => alternarTramite(t.id)}
                        className="h-3.5 w-3.5 rounded border-stone-300 text-cdmb-600 focus:ring-cdmb-500"
                      />
                      <span className="text-xs text-stone-400">{t.codigo}</span> {t.nombre}
                    </label>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-cdmb-600 px-5 py-2 text-sm font-medium text-white hover:bg-cdmb-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? "Guardando…" : modo === "crear" ? "Crear rol" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
