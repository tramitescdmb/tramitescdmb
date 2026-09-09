"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquareText, Upload, X } from "lucide-react";
import { subirArchivoDirecto, subirDocumentosConProgreso } from "@/lib/uploads-client";
import { ACCEPT_DOCUMENTOS, extensionPermitida, mensajeTipoNoPermitido } from "@/lib/uploads-config";
import { BarraProgresoEnvio } from "@/components/BarraProgresoEnvio";
import { PlantillaSelector, type PlantillaOpcion } from "@/components/PlantillaSelector";
import { contextoBase, type ContextoMarcadores } from "@/lib/plantillas-marcadores";

export function RespuestaFuncionarioForm({
  comunicacionId,
  textoInicial,
  plantillas = [],
  contexto = {},
}: {
  comunicacionId: string;
  textoInicial: string;
  plantillas?: PlantillaOpcion[];
  contexto?: ContextoMarcadores;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(textoInicial);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<{ pct: number; texto: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function agregarArchivos(lista: FileList | null) {
    if (!lista) return;
    const nuevos: File[] = [];
    for (const f of Array.from(lista)) {
      if (!extensionPermitida(f.name)) {
        setError(mensajeTipoNoPermitido(f.name));
        continue;
      }
      nuevos.push(f);
    }
    setArchivos((prev) => [...prev, ...nuevos]);
  }

  async function guardar() {
    setError(null);
    if (!texto.trim()) return setError("Escriba el contenido de la respuesta.");
    setEnviando(true);
    setProgreso({ pct: 0, texto: "Preparando…" });
    try {
      const folder = crypto.randomUUID();
      const documentos = await subirDocumentosConProgreso(
        archivos,
        (f, file) => subirArchivoDirecto(f, file, { nuevo: true }),
        folder,
        (pct, t) => setProgreso({ pct, texto: t }),
        "Guardando la respuesta…"
      );
      const resp = await fetch(`/api/correspondencia/${comunicacionId}/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: texto.trim(), documentos }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || "No se pudo guardar la respuesta.");
      setProgreso({ pct: 100, texto: "Listo." });
      setArchivos([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la respuesta.");
    } finally {
      setEnviando(false);
      setProgreso(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">
          Escribir respuesta <span className="text-red-500">*</span>
        </label>
        <div className="mb-2">
          <PlantillaSelector plantillas={plantillas} contenidoActual={texto} onCargar={setTexto} contexto={{ ...contextoBase(), ...contexto }} />
        </div>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={5}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          placeholder="Contenido de la respuesta…"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Adjuntar documento (PDF, Word u otro)</label>
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50">
          <Upload className="h-4 w-4" aria-hidden />
          Agregar archivos
          <input type="file" multiple accept={ACCEPT_DOCUMENTOS} className="hidden" onChange={(e) => agregarArchivos(e.target.files)} />
        </label>
        {archivos.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {archivos.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-1.5 text-sm">
                <span className="truncate text-stone-700" title={f.name}>{f.name}</span>
                <button type="button" onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))} className="flex-none text-stone-400 hover:text-red-600">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {progreso && <BarraProgresoEnvio pct={progreso.pct} texto={progreso.texto} />}
      <button
        type="button"
        onClick={guardar}
        disabled={enviando}
        className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-60"
      >
        {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <MessageSquareText className="h-3.5 w-3.5" aria-hidden />}
        {enviando ? "Guardando…" : "Guardar respuesta"}
      </button>
    </div>
  );
}
