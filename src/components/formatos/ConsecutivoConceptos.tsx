"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { Spinner } from "@/components/Spinner";

export function ConsecutivoConceptos({ anio, siguiente }: { anio: number; siguiente: number | null }) {
  const router = useRouter();
  const [valor, setValor] = useState(siguiente ? String(siguiente) : "");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  async function guardar() {
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/formatos-visita/consecutivo", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anio, siguiente: Number(valor) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      setMensaje({ ok: true, texto: "Guardado." });
      router.refresh();
    } catch (e) {
      setMensaje({ ok: false, texto: e instanceof Error ? e.message : "Ocurrió un error inesperado." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-3 py-2 shadow-soft">
      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
        <span className="font-medium text-stone-800">Conceptos técnicos {anio}</span>
        <span
          title="Número EV que recibirá el próximo concepto técnico. Debe continuar el consecutivo que se lleva hoy (incluido SINCA 1.0) para no repetir números."
          className="cursor-help text-stone-400"
        >
          <Info className="h-3.5 w-3.5" aria-label="Información del consecutivo" />
        </span>
        <label className="inline-flex items-center gap-1">
          siguiente EV-
          <input value={valor} onChange={(e) => setValor(e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" placeholder="0000" className="w-16 rounded border border-stone-200 px-1.5 py-1 text-xs" />
        </label>
        <button type="button" onClick={guardar} disabled={enviando || !valor} className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50">
          {enviando && <Spinner />}
          Guardar
        </button>
      </div>
      {siguiente == null && !mensaje && <p className="mt-1 text-[11px] text-amber-700">Sin configurar: los técnicos no podrán numerar conceptos hasta indicar el siguiente número.</p>}
      {mensaje && <p className={`mt-1 text-[11px] ${mensaje.ok ? "text-emerald-700" : "text-red-600"}`}>{mensaje.texto}</p>}
    </div>
  );
}
