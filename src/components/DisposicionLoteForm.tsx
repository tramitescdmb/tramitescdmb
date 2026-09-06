"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, CheckSquare, Square } from "lucide-react";
import { Field } from "@/components/Field";

export type ItemDisposicionPendiente = {
  id: string;
  radicado: string;
  asunto: string;
  serieSubserie: string;
  fechaFinCentral: string;
  etiquetas: string;
  exigeActa: boolean;
  sinDisposicionDefinida: boolean;
};

const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

/**
 * Antes cada comunicación pendiente tenía su propio formulario y botón —
 * disponer 30 a la vez exigía 30 envíos. Ahora se seleccionan varias y
 * comparten una sola acta si la disposición lo exige (MoReq 2.9: "individual
 * o por lotes"). Seleccionar solo una sigue funcionando igual que antes.
 */
export function DisposicionLoteForm({ items }: { items: ItemDisposicionPendiente[] }) {
  const router = useRouter();
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [responsable, setResponsable] = useState("");
  const [motivacion, setMotivacion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<string | null>(null);

  const seleccionables = items.filter((i) => !i.sinDisposicionDefinida);
  const algunaExigeActa = items.some((i) => seleccion.has(i.id) && i.exigeActa);
  const todosSeleccionados = seleccionables.length > 0 && seleccionables.every((i) => seleccion.has(i.id));

  function alternar(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function alternarTodos() {
    setSeleccion(todosSeleccionados ? new Set() : new Set(seleccionables.map((i) => i.id)));
  }

  async function ejecutar() {
    if (seleccion.size === 0) return;
    if (algunaExigeActa && !responsable.trim()) {
      setError("Alguna comunicación seleccionada exige eliminación o selección: indique quién la aprueba.");
      return;
    }
    setEnviando(true);
    setError(null);
    setResumen(null);
    try {
      const res = await fetch("/api/correspondencia/disponer-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comunicacionIds: Array.from(seleccion), responsable, motivacion }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo ejecutar la disposición final.");
      const partes = [`${body.dispuestas} comunicación(es) dispuesta(s)${body.actaId ? " (con acta)" : ""}.`];
      if (body.omitidas?.length > 0) partes.push(`${body.omitidas.length} omitida(s): ${body.omitidas.map((o: { motivo: string }) => o.motivo).join(" ")}`);
      setResumen(partes.join(" "));
      setSeleccion(new Set());
      setResponsable("");
      setMotivacion("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3">
      {seleccionables.length > 0 && (
        <button
          type="button"
          onClick={alternarTodos}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-cdmb-700 hover:underline"
        >
          {todosSeleccionados ? <CheckSquare className="h-3.5 w-3.5" aria-hidden /> : <Square className="h-3.5 w-3.5" aria-hidden />}
          {todosSeleccionados ? "Quitar selección" : `Seleccionar las ${seleccionables.length} pendientes`}
        </button>
      )}

      <div className="space-y-2">
        {items.map((c) => (
          <div key={c.id} className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={seleccion.has(c.id)}
                  disabled={c.sinDisposicionDefinida}
                  onChange={() => alternar(c.id)}
                  className="mt-1 rounded border-stone-300"
                  aria-label={`Seleccionar ${c.radicado}`}
                />
                <div className="min-w-0">
                  <Link href={`/correspondencia/${c.id}`} className="font-medium text-cdmb-700 hover:underline">
                    {c.radicado}
                  </Link>
                  <p className="truncate text-xs text-stone-500">{c.asunto}</p>
                  <p className="text-[11px] text-stone-400">{c.serieSubserie} — cumplió su retención el {c.fechaFinCentral}</p>
                </div>
              </div>
              <span className="flex-none rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                {c.sinDisposicionDefinida ? "Sin disposición definida en la TRD" : c.etiquetas}
              </span>
            </div>
            {c.sinDisposicionDefinida && (
              <p className="mt-2 text-xs text-amber-700">Configure la disposición final de esta subserie en Administración antes de poder ejecutarla.</p>
            )}
          </div>
        ))}
      </div>

      {seleccionables.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
          <p className="mb-3 text-sm font-medium text-stone-700">
            {seleccion.size === 0 ? "Seleccione una o varias comunicaciones arriba." : `${seleccion.size} seleccionada(s).`}
          </p>
          {algunaExigeActa && (
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Aprobada por" required help="Nombre de quien autoriza en el comité de archivo. Aplica a las que exigen acta (eliminación/selección).">
                <input value={responsable} onChange={(e) => setResponsable(e.target.value)} className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Motivación" help="Por qué se dispone así este lote.">
                  <input value={motivacion} onChange={(e) => setMotivacion(e.target.value)} className={inputCls} />
                </Field>
              </div>
            </div>
          )}
          {error && <p className="mb-2 text-xs text-red-700">{error}</p>}
          {resumen && <p className="mb-2 text-xs text-green-700">{resumen}</p>}
          <button
            type="button"
            onClick={ejecutar}
            disabled={seleccion.size === 0 || enviando}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Archive className="h-3.5 w-3.5" aria-hidden />
            {enviando ? "Ejecutando…" : `Ejecutar disposición final${seleccion.size > 1 ? ` (${seleccion.size})` : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
