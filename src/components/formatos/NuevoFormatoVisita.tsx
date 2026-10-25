"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download } from "lucide-react";
import { Spinner } from "@/components/Spinner";

const campo = "w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";

export function NuevoFormatoVisita({
  formatos,
  faltanBase,
  tramitesLibres,
}: {
  formatos: { id: string; nombre: string; codigo: string }[];
  faltanBase: string[];
  tramitesLibres: { codigo: string; nombre: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [titulo, setTitulo] = useState("");
  const [copiarDe, setCopiarDe] = useState("");
  const [tramites, setTramites] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar(cuerpo: Record<string, unknown>) {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/formatos-visita", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo completar la operación.");
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error inesperado.");
      return null;
    } finally {
      setEnviando(false);
    }
  }

  async function crear() {
    const data = await enviar({ codigo, nombre, titulo, copiarDe: copiarDe || undefined, tramites });
    if (data?.id) router.push(`/planeador/formatos/${data.id}`);
  }

  async function sembrar() {
    const data = await enviar({ accion: "sembrar" });
    if (data) {
      setAviso(data.creados.length ? `Se cargaron los formatos ${data.creados.join(", ")}.` : "Los formatos base ya estaban cargados.");
      router.refresh();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setAbierto((v) => !v)} className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-acento-600">
          <Plus className="h-4 w-4" aria-hidden />
          Nuevo formato
        </button>
        {faltanBase.length > 0 && (
          <button type="button" onClick={sembrar} disabled={enviando} className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60">
            {enviando ? <Spinner /> : <Download className="h-4 w-4" aria-hidden />}
            Cargar formatos base ({faltanBase.join(", ")})
          </button>
        )}
      </div>
      {aviso && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{aviso}</p>}
      {abierto && (
        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-stone-200 bg-white p-4 shadow-soft sm:grid-cols-2">
          <label className="text-xs text-stone-600">
            Código
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="M-DA-FO00" className={`mt-0.5 ${campo}`} />
          </label>
          <label className="text-xs text-stone-600">
            Nombre corto
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ocupación de cauce" className={`mt-0.5 ${campo}`} />
          </label>
          <label className="text-xs text-stone-600 sm:col-span-2">
            Título del documento
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="CONCEPTO TÉCNICO …" className={`mt-0.5 ${campo}`} />
          </label>
          <label className="text-xs text-stone-600 sm:col-span-2">
            Partir de
            <select value={copiarDe} onChange={(e) => setCopiarDe(e.target.value)} className={`mt-0.5 ${campo}`}>
              <option value="">Formato en blanco</option>
              {formatos.map((f) => (
                <option key={f.id} value={f.id}>
                  Copia de {f.nombre} ({f.codigo})
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs text-stone-600 sm:col-span-2">
            Trámites que usarán este formato ({tramites.length})
            {tramitesLibres.length === 0 ? (
              <p className="mt-0.5 text-stone-400">Todos los trámites con visita ya tienen un formato propio.</p>
            ) : (
              <div className="mt-0.5 max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-stone-200 p-1.5">
                {tramitesLibres.map((t) => (
                  <label key={t.codigo} className="flex items-start gap-2 rounded px-1.5 py-1 text-stone-700 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={tramites.includes(t.codigo)}
                      onChange={() => setTramites(tramites.includes(t.codigo) ? tramites.filter((x) => x !== t.codigo) : [...tramites, t.codigo])}
                      className="mt-0.5 text-cdmb-600"
                    />
                    <span>
                      <span className="font-mono text-[11px] text-stone-400">{t.codigo}</span> {t.nombre}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <button type="button" onClick={crear} disabled={enviando} className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-60">
              {enviando && <Spinner claro />}
              Crear y diseñar
            </button>
          </div>
        </div>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
