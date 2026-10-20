"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function NuevoPerfilForm({ modulos, perfiles }: { modulos: { valor: string; etiqueta: string }[]; perfiles: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [modulo, setModulo] = useState("GENERAL");
  const [descripcion, setDescripcion] = useState("");
  const [copiarDeId, setCopiarDeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/admin/perfiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, modulo, descripcion, copiarDeId: copiarDeId || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "No se pudo crear el perfil.");
      router.push(`/admin/perfiles/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el perfil.");
      setEnviando(false);
    }
  }

  const campo = "w-full rounded border border-stone-300 px-3 py-2 text-sm";

  return (
    <form onSubmit={crear} className="rounded-md border border-stone-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-stone-900">Nuevo perfil</h2>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="text-xs font-medium text-stone-600">
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className={`${campo} mt-1`} />
        </label>
        <label className="text-xs font-medium text-stone-600">
          Módulo
          <select value={modulo} onChange={(e) => setModulo(e.target.value)} className={`${campo} mt-1`}>
            {modulos.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-stone-600">
          Partir de
          <select value={copiarDeId} onChange={(e) => setCopiarDeId(e.target.value)} className={`${campo} mt-1`}>
            <option value="">Sin permisos (vacío)</option>
            {perfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-stone-600">
          Descripción
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={`${campo} mt-1`} />
        </label>
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="mt-3 inline-flex items-center gap-1.5 rounded bg-acento-500 px-4 py-2 text-sm font-semibold text-white hover:bg-acento-600 disabled:opacity-60"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Crear perfil
      </button>
    </form>
  );
}
