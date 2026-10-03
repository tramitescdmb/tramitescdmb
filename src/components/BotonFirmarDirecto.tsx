"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenTool } from "lucide-react";

const CALIDADES = [
  { valor: "PROYECTO", texto: "Proyectó" },
  { valor: "REVISO", texto: "Revisó" },
  { valor: "PRINCIPAL", texto: "Firma principal" },
] as const;

export function BotonFirmarDirecto({
  endpoint,
  descripcion,
  conCalidad = false,
  calidadInicial = "PROYECTO",
}: {
  endpoint: string;
  descripcion: string;
  conCalidad?: boolean;
  calidadInicial?: (typeof CALIDADES)[number]["valor"];
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calidad, setCalidad] = useState<string>(calidadInicial);

  async function firmar() {
    const etiqueta = CALIDADES.find((c) => c.valor === calidad)?.texto;
    if (!window.confirm(`${descripcion}${conCalidad ? `\nCalidad: ${etiqueta}.` : ""}\n\n¿Confirma su firma electrónica?`)) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(conCalidad ? { calidad } : {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo registrar la firma.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5">
        {conCalidad && (
          <select
            value={calidad}
            onChange={(e) => setCalidad(e.target.value)}
            aria-label="Calidad en que firma"
            className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-700"
          >
            {CALIDADES.map((c) => (
              <option key={c.valor} value={c.valor}>{c.texto}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={firmar}
          disabled={cargando}
          className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
        >
          <PenTool className="h-3.5 w-3.5" aria-hidden />
          {cargando ? "Firmando…" : "Firmar"}
        </button>
      </span>
      {error && <span className="max-w-xs text-xs text-red-700">{error}</span>}
    </span>
  );
}
