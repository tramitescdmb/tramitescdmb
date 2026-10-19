"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { CampoMoneda } from "@/components/CampoMoneda";
import { formatearPesosCO } from "@/lib/moneda";
import { minimaCuantia, type TopeCuantia } from "@/lib/cuantias";

const campo = "rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";

export function TopesCuantiaAdmin({ topes, puedeEditar }: { topes: TopeCuantia[]; puedeEditar: boolean }) {
  const router = useRouter();
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [valor, setValor] = useState("");
  const [soporte, setSoporte] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anioActual = new Date().getFullYear();

  function editar(t: TopeCuantia) {
    setAnio(String(t.anio));
    setValor(String(t.menorCuantia));
    setSoporte(t.soporte ?? "");
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/contratacion/cuantias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anio: Number(anio), menorCuantia: Number(valor), soporte }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo guardar.");
      setValor("");
      setSoporte("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      {!topes.some((t) => t.anio === anioActual) && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No hay topes registrados para {anioActual}: el valor de los contratos de esta vigencia no se valida frente a la modalidad.
        </p>
      )}

      {puedeEditar && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-3">
          <label className="flex flex-col gap-1 text-xs text-stone-600">
            Año
            <input type="number" min={2000} max={2100} value={anio} onChange={(e) => setAnio(e.target.value)} className={`${campo} w-24`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-stone-600">
            Menor cuantía ($)
            <CampoMoneda value={valor} onChange={setValor} className="w-48" />
          </label>
          <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs text-stone-600">
            Soporte
            <input value={soporte} onChange={(e) => setSoporte(e.target.value)} placeholder="Ej. Circular N.° 001 del 15 de enero de 2026" className={campo} />
          </label>
          {valor && <span className="pb-2 text-[11px] text-stone-500">Mínima cuantía: {formatearPesosCO(minimaCuantia({ menorCuantia: Number(valor) }))}</span>}
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !valor}
            className="rounded-lg bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar vigencia"}
          </button>
          {error && <p className="basis-full text-xs text-red-700">{error}</p>}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="tabla-listado w-full text-xs">
          <thead className="bg-stone-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            <tr>
              <th className="px-3 py-1.5">Vigencia</th>
              <th className="px-3 py-1.5">Menor cuantía</th>
              <th className="px-3 py-1.5">Mínima cuantía (10 %)</th>
              <th className="px-3 py-1.5">Soporte</th>
              {puedeEditar && <th className="px-3 py-1.5" aria-label="Editar" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {topes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-stone-400">
                  Sin vigencias registradas.
                </td>
              </tr>
            )}
            {topes.map((t) => (
              <tr key={t.anio}>
                <td className="px-3 py-1.5 font-semibold text-stone-800">{t.anio}</td>
                <td className="px-3 py-1.5 text-stone-700">{formatearPesosCO(t.menorCuantia)}</td>
                <td className="px-3 py-1.5 text-stone-700">{formatearPesosCO(minimaCuantia(t))}</td>
                <td className="px-3 py-1.5 text-stone-500">{t.soporte ?? "—"}</td>
                {puedeEditar && (
                  <td className="px-3 py-1.5 text-right">
                    <button type="button" onClick={() => editar(t)} className="text-stone-400 hover:text-cdmb-700" title="Editar esta vigencia">
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
