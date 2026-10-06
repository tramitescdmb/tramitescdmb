"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import type { EstadoRequisitoMoreq } from "@prisma/client";

const ESTADOS: { valor: EstadoRequisitoMoreq; etiqueta: string }[] = [
  { valor: "COMPLETO", etiqueta: "Completo" },
  { valor: "PARCIAL", etiqueta: "Parcial" },
  { valor: "PENDIENTE", etiqueta: "Pendiente" },
];

export function EditarRequisitoMoreq({
  id,
  numero,
  titulo,
  estado,
  nota,
}: {
  id: string;
  numero: string;
  titulo: string;
  estado: EstadoRequisitoMoreq;
  nota: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [valorTitulo, setValorTitulo] = useState(titulo);
  const [valorEstado, setValorEstado] = useState<EstadoRequisitoMoreq>(estado);
  const [valorNota, setValorNota] = useState(nota);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cancelar() {
    setValorTitulo(titulo);
    setValorEstado(estado);
    setValorNota(nota);
    setError(null);
    setAbierto(false);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/correspondencia/matriz-moreq/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: valorTitulo, estado: valorEstado, nota: valorNota }),
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(cuerpo.error || "No se pudo guardar.");
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
        className="ml-1 inline-flex rounded p-0.5 align-middle text-stone-400 hover:bg-cdmb-50 hover:text-cdmb-700 print:hidden"
        aria-label={`Editar el requisito ${numero}`}
        title="Editar"
      >
        <Pencil className="h-3 w-3" aria-hidden />
      </button>
    );
  }

  return (
    <form onSubmit={guardar} className="mt-2 space-y-2 rounded-lg border border-cdmb-200 bg-cdmb-50/40 p-3 print:hidden">
      <label className="block text-[11px] font-medium text-stone-600">
        Requisito
        <input
          value={valorTitulo}
          onChange={(e) => setValorTitulo(e.target.value)}
          required
          className="mt-0.5 w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-800"
        />
      </label>
      <label className="block text-[11px] font-medium text-stone-600">
        Estado
        <select
          value={valorEstado}
          onChange={(e) => setValorEstado(e.target.value as EstadoRequisitoMoreq)}
          className="mt-0.5 block rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-800"
        >
          {ESTADOS.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11px] font-medium text-stone-600">
        Nota y evidencia
        <textarea
          value={valorNota}
          onChange={(e) => setValorNota(e.target.value)}
          required
          rows={5}
          className="mt-0.5 w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-800"
        />
      </label>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={guardando}
          className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600 disabled:opacity-50"
        >
          {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          Guardar
        </button>
        <button type="button" onClick={cancelar} className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
          Cancelar
        </button>
      </div>
    </form>
  );
}
