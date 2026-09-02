"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Opcion = { id: string; nombre: string };

export function EditarUsuarioForm({
  usuarioId,
  rolActual,
  cargoActualId,
  rolPermisosActualId,
  cargos,
  roles,
}: {
  usuarioId: string;
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
    "w-full rounded-md border border-stone-300 px-2 py-1 text-xs focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs text-stone-500 hover:text-cdmb-700 hover:underline"
      >
        Editar
      </button>
    );
  }

  return (
    <div className="w-56 space-y-1.5 rounded-md border border-stone-200 bg-stone-50 p-2 text-left">
      <label className="block text-[11px] font-medium text-stone-500">
        Rol
        <select value={rol} onChange={(e) => setRol(e.target.value as "ADMIN" | "FUNCIONARIO")} className={selectClase}>
          <option value="FUNCIONARIO">Funcionario</option>
          <option value="ADMIN">Administrador</option>
        </select>
      </label>
      <label className="block text-[11px] font-medium text-stone-500">
        Cargo
        <select value={cargoId} onChange={(e) => setCargoId(e.target.value)} className={selectClase}>
          <option value="">Sin especificar</option>
          {cargos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11px] font-medium text-stone-500">
        Rol de acceso
        <select value={rolPermisosId} onChange={(e) => setRolPermisosId(e.target.value)} className={selectClase}>
          <option value="">Sin restricción</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-md bg-cdmb-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cdmb-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          disabled={guardando}
          className="text-[11px] text-stone-500 hover:text-stone-700"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
