"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, X } from "lucide-react";

export const CARGO_PROFESIONAL_EVALUACION = "Profesional o Técnico de Evaluación";

type UsuarioOpcion = { id: string; nombre: string; cargos: string[]; dependenciaNombre: string | null };

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function PersonalAsignadoTramiteForm({
  expedienteId,
  usuarios,
  cargos,
  usuariosIniciales,
  cargosIniciales,
}: {
  expedienteId: string;
  usuarios: UsuarioOpcion[];
  cargos: { id: string; nombre: string }[];
  usuariosIniciales: string[];
  cargosIniciales: string[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set(usuariosIniciales));
  const [cargosSel, setCargosSel] = useState<Set<string>>(new Set(cargosIniciales));
  const hayProfesionales = usuarios.some((u) => u.cargos.includes(CARGO_PROFESIONAL_EVALUACION));
  const [cargoFiltro, setCargoFiltro] = useState(hayProfesionales ? CARGO_PROFESIONAL_EVALUACION : "");
  const [filtro, setFiltro] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = normalizar(filtro.trim());
  const filtrados = usuarios.filter(
    (u) =>
      seleccion.has(u.id) ||
      ((!cargoFiltro || u.cargos.includes(cargoFiltro)) && (!q || normalizar(`${u.nombre} ${u.dependenciaNombre ?? ""}`).includes(q)))
  );
  const cargosConUsuarios = cargos.filter((c) => usuarios.some((u) => u.cargos.includes(c.nombre)));

  function alternar(conjunto: Set<string>, fijar: (s: Set<string>) => void, id: string) {
    const next = new Set(conjunto);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    fijar(next);
  }

  function abrir() {
    setSeleccion(new Set(usuariosIniciales));
    setCargosSel(new Set(cargosIniciales));
    setError(null);
    setAbierto(true);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/expedientes/${expedienteId}/asignar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioIds: Array.from(seleccion), cargoIds: Array.from(cargosSel) }),
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
        onClick={abrir}
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        <UserCheck className="h-3 w-3" aria-hidden />
        Editar personal asignado
      </button>

      {abierto && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Personal asignado al trámite</h3>
              <button type="button" onClick={() => setAbierto(false)} className="text-stone-400 hover:text-stone-600" aria-label="Cerrar">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={cargoFiltro}
                onChange={(e) => setCargoFiltro(e.target.value)}
                aria-label="Filtrar por cargo"
                className="w-full rounded-md border border-stone-200 px-2 py-1.5 text-xs"
              >
                <option value="">Todos los cargos</option>
                {cargosConUsuarios.map((c) => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <input
                type="search"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar por nombre…"
                className="w-full rounded-md border border-stone-200 px-2 py-1.5 text-xs"
              />
            </div>

            <div className="max-h-60 space-y-0.5 overflow-y-auto rounded-md border border-stone-100 p-1">
              {filtrados.length === 0 ? (
                <p className="px-1 py-2 text-xs text-stone-400">Ningún usuario coincide con el filtro.</p>
              ) : (
                filtrados.map((u) => (
                  <label key={u.id} className="flex items-start gap-2 rounded px-1 py-1 text-sm text-stone-700 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={seleccion.has(u.id)}
                      onChange={() => alternar(seleccion, setSeleccion, u.id)}
                      className="mt-0.5 rounded border-stone-300"
                    />
                    <span className="min-w-0">
                      {u.nombre}
                      <span className="block truncate text-[11px] text-stone-400">
                        {[u.cargos.join(", "), u.dependenciaNombre].filter(Boolean).join(" · ") || "Sin cargo"}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-cdmb-700">Asignar un cargo completo ({cargosSel.size})</summary>
              <div className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                {cargos.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs text-stone-700 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={cargosSel.has(c.id)}
                      onChange={() => alternar(cargosSel, setCargosSel, c.id)}
                      className="rounded border-stone-300"
                    />
                    {c.nombre}
                  </label>
                ))}
              </div>
            </details>

            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="mt-3 w-full rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600 disabled:opacity-50"
            >
              {guardando ? "Guardando…" : `Guardar (${seleccion.size} ${seleccion.size === 1 ? "persona" : "personas"})`}
            </button>
            {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
