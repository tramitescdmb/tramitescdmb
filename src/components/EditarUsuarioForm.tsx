"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Opcion = { id: string; nombre: string };

export function EditarUsuarioForm({
  usuarioId,
  nombreUsuario,
  rolActual,
  cargoActualId,
  rolPermisosActualId,
  cargos,
  roles,
}: {
  usuarioId: string;
  nombreUsuario: string;
  rolActual: "ADMIN" | "FUNCIONARIO";
  cargoActualId: string | null;
  rolPermisosActualId: string | null;
  cargos: Opcion[];
  roles: Opcion[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rol, setRol] = useState(rolActual);
  const [cargoId, setCargoId] = useState(cargoActualId ?? "");
  const [rolPermisosId, setRolPermisosId] = useState(rolPermisosActualId ?? "");

  function abrir() {
    // Vuelve a partir de los valores actuales cada vez que se abre, por si se
    // canceló una edición anterior con cambios sin guardar.
    setRol(rolActual);
    setCargoId(cargoActualId ?? "");
    setRolPermisosId(rolPermisosActualId ?? "");
    setError(null);
    setAbierto(true);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/usuarios/${usuarioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rol, cargoId: cargoId || null, rolPermisosId: rolPermisosId || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo guardar.");
      }
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  const selectClase =
    "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

  return (
    <>
      <button type="button" onClick={abrir} className="text-xs text-stone-500 hover:text-cdmb-700 hover:underline">
        Editar
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-stone-900">Editar a {nombreUsuario}</h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-stone-600">Rol</span>
                <select value={rol} onChange={(e) => setRol(e.target.value as "ADMIN" | "FUNCIONARIO")} className={selectClase}>
                  <option value="FUNCIONARIO">Funcionario</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-stone-600">Cargo</span>
                <select value={cargoId} onChange={(e) => setCargoId(e.target.value)} className={selectClase}>
                  <option value="">Sin especificar</option>
                  {cargos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-stone-600">Rol de acceso</span>
                <select value={rolPermisosId} onChange={(e) => setRolPermisosId(e.target.value)} className={selectClase}>
                  <option value="">Sin restricción</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error && <p className="mt-3 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</p>}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                disabled={guardando}
                className="text-sm text-stone-500 hover:text-stone-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando}
                className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
