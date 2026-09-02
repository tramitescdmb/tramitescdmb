"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";

type Opcion = { id: string; nombre: string };
type RolAccesoOpcion = Opcion & { todosLosTramites: boolean; tramitesCount: number };

export function EditarUsuarioForm({
  usuarioId,
  nombreUsuario,
  rolActual,
  cargoActualIds,
  rolPermisosActualId,
  cargos,
  roles,
}: {
  usuarioId: string;
  nombreUsuario: string;
  rolActual: "ADMIN" | "FUNCIONARIO";
  cargoActualIds: string[];
  rolPermisosActualId: string | null;
  cargos: Opcion[];
  roles: RolAccesoOpcion[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rol, setRol] = useState(rolActual);
  const [cargoIds, setCargoIds] = useState<Set<string>>(new Set(cargoActualIds));
  const [rolPermisosId, setRolPermisosId] = useState(rolPermisosActualId ?? "");

  // Mientras el modal está abierto, la página de atrás no debe poder scrollear
  // — si no, el scroll horizontal de la tabla (más ancha que la pantalla) se
  // ve/compite con el del modal y da la sensación de que todo está "cortado".
  useEffect(() => {
    if (!abierto) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [abierto]);

  function abrir() {
    // Vuelve a partir de los valores actuales cada vez que se abre, por si se
    // canceló una edición anterior con cambios sin guardar.
    setRol(rolActual);
    setCargoIds(new Set(cargoActualIds));
    setRolPermisosId(rolPermisosActualId ?? "");
    setError(null);
    setAbierto(true);
  }

  function alternarCargo(id: string) {
    setCargoIds((prev) => {
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
      const res = await fetch(`/api/usuarios/${usuarioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rol, cargoIds: Array.from(cargoIds), rolPermisosId: rolPermisosId || null }),
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

  const rolSeleccionado = roles.find((r) => r.id === rolPermisosId);

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-cdmb-700"
      >
        <Pencil className="h-3 w-3" aria-hidden />
        Editar
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-stone-100 px-6 py-4">
              <h2 className="text-base font-semibold text-stone-900">Editar a {nombreUsuario}</h2>
              <p className="mt-0.5 text-xs text-stone-400">Cargo(s), rol y rol de acceso dentro de la app.</p>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">Rol</span>
                <div className="grid grid-cols-2 gap-2">
                  {(["FUNCIONARIO", "ADMIN"] as const).map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setRol(valor)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        rol === valor
                          ? "border-cdmb-600 bg-cdmb-50 text-cdmb-800"
                          : "border-stone-200 text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      {valor === "ADMIN" ? "Administrador" : "Funcionario"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-stone-100 pt-5">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Cargo(s) en la CDMB
                </span>
                <p className="mb-2 text-xs text-stone-400">
                  Puede seleccionar uno, varios, o todos los que correspondan — se usan para saber qué pasos le corresponden.
                </p>
                <div className="flex flex-wrap gap-1.5 rounded-lg border border-stone-100 bg-stone-50/60 p-2.5">
                  {cargos.map((c) => {
                    const activo = cargoIds.has(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => alternarCargo(c.id)}
                        aria-pressed={activo}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          activo
                            ? "border-cdmb-600 bg-cdmb-600 text-white"
                            : "border-stone-200 bg-white text-stone-600 hover:border-cdmb-300 hover:text-cdmb-700"
                        }`}
                      >
                        {c.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-stone-100 pt-5">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500">Rol de acceso</span>
                <p className="mb-2 text-xs text-stone-400">
                  Restringe a cuáles trámites de &quot;Trámites ambientales 2.0&quot; puede entrar. Sin ninguno
                  seleccionado (&quot;Sin restricción&quot;), el usuario ve todos los trámites — es el valor por
                  defecto para todos hasta que se le asigne uno a propósito.
                </p>
                <select
                  value={rolPermisosId}
                  onChange={(e) => setRolPermisosId(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
                >
                  <option value="">Sin restricción</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
                {rolSeleccionado && (
                  <p className="mt-1.5 text-xs text-stone-500">
                    {rolSeleccionado.todosLosTramites
                      ? "Este rol no restringe trámites (los tiene todos permitidos)."
                      : `Restringido a ${rolSeleccionado.tramitesCount} trámite${rolSeleccionado.tramitesCount === 1 ? "" : "s"} — ver o cambiar cuáles en Roles.`}
                  </p>
                )}
                {roles.length === 0 && (
                  <p className="mt-1.5 text-xs text-stone-500">
                    Aún no ha creado ningún rol de acceso.{" "}
                    <Link href="/roles/nuevo" className="text-cdmb-700 underline hover:text-cdmb-800">
                      Crear uno en Roles
                    </Link>{" "}
                    si necesita limitar a un usuario a ciertos trámites.
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-stone-100 px-6 py-4">
              {error && <p className="mb-3 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</p>}
              <div className="flex items-center justify-end gap-3">
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
                  className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white transition-transform hover:bg-cdmb-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
                >
                  {guardando ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
