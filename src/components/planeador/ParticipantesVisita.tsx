"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users } from "lucide-react";
import type { RolParticipanteVisita } from "@prisma/client";
import { Spinner } from "@/components/Spinner";
import { ETIQUETA_ROL_PARTICIPANTE, ROLES_PARTICIPANTE } from "@/lib/participantes-visita";

type Persona = { id: string; nombre: string; detalle: string; asignado: boolean; contratista: boolean };
type Fila = { usuarioId: string; rol: RolParticipanteVisita };

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function ParticipantesVisita({
  visitaId,
  iniciales,
  personas,
  editable,
  firmas,
}: {
  visitaId: string;
  iniciales: Fila[];
  personas: Persona[];
  editable: boolean;
  firmas?: Record<string, string>;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [filas, setFilas] = useState<Fila[]>(iniciales);
  const [buscar, setBuscar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const porId = new Map(personas.map((p) => [p.id, p]));

  const q = normalizar(buscar.trim());
  const candidatas = q
    ? personas.filter((p) => !filas.some((f) => f.usuarioId === p.id) && normalizar(`${p.nombre} ${p.detalle}`).includes(q)).slice(0, 8)
    : personas.filter((p) => p.asignado && !filas.some((f) => f.usuarioId === p.id));

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/visitas-programadas/${visitaId}/participantes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantes: filas }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo guardar.");
      setEditando(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <Users className="h-4 w-4 text-stone-400" aria-hidden />
          Equipo de la visita y firmantes del concepto
        </h3>
        {editable && !editando && (
          <button type="button" onClick={() => { setFilas(iniciales); setEditando(true); }} className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50">
            Editar equipo
          </button>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-500">
            <th className="py-1 pr-2 font-medium">Persona</th>
            <th className="py-1 pr-2 font-medium">Rol</th>
            {firmas && <th className="py-1 pr-2 font-medium">Firma</th>}
            {editando && <th className="w-8" />}
          </tr>
        </thead>
        <tbody>
          {(editando ? filas : iniciales).map((f, i) => {
            const p = porId.get(f.usuarioId);
            return (
              <tr key={f.usuarioId} className="border-b border-stone-100 last:border-0">
                <td className="py-1.5 pr-2">
                  {p?.nombre ?? "—"}
                  <span className="block text-[11px] text-stone-400">{p?.detalle}</span>
                </td>
                <td className="py-1.5 pr-2">
                  {editando ? (
                    <select
                      value={f.rol}
                      aria-label={`Rol de ${p?.nombre ?? "la persona"}`}
                      onChange={(e) => setFilas(filas.map((x, j) => (j === i ? { ...x, rol: e.target.value as RolParticipanteVisita } : x)))}
                      className="w-full rounded-md border border-stone-200 px-2 py-1 text-xs"
                    >
                      {ROLES_PARTICIPANTE.map((r) => (
                        <option key={r} value={r} disabled={r === "APRUEBA" && p?.contratista}>
                          {ETIQUETA_ROL_PARTICIPANTE[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-stone-700">{ETIQUETA_ROL_PARTICIPANTE[f.rol]}</span>
                  )}
                </td>
                {firmas && <td className="py-1.5 pr-2 text-xs text-stone-600">{firmas[f.usuarioId] ?? "—"}</td>}
                {editando && (
                  <td>
                    <button type="button" onClick={() => setFilas(filas.filter((_, j) => j !== i))} aria-label={`Quitar a ${p?.nombre ?? "la persona"}`} className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {editando && (
        <div className="mt-3 space-y-2">
          <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar otra persona por nombre o cargo…" className="w-full rounded-md border border-stone-200 px-2 py-1.5 text-xs" />
          {candidatas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {candidatas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setFilas([...filas, { usuarioId: p.id, rol: filas.some((f) => f.rol === "ELABORA") ? "REVISA_TECNICO" : "ELABORA" }]);
                    setBuscar("");
                  }}
                  className="inline-flex items-center gap-1 rounded-sm border border-stone-200 px-2 py-1 text-xs text-stone-700 hover:border-cdmb-300 hover:bg-cdmb-50"
                >
                  <Plus className="h-3 w-3" aria-hidden />
                  {p.nombre}
                  {p.contratista && <span className="text-[10px] text-stone-400">· contratista</span>}
                </button>
              ))}
            </div>
          )}
          {error && <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={guardar} disabled={guardando} className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60">
              {guardando && <Spinner claro />}
              Guardar equipo
            </button>
            <button type="button" onClick={() => setEditando(false)} className="rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
