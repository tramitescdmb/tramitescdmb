"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Loader2 } from "lucide-react";
import { subirArchivoExpediente, sha256Hex } from "@/lib/uploads-client";
import { ACCEPT_DOCUMENTOS, extensionPermitida, mensajeTipoNoPermitido } from "@/lib/uploads-config";

export function SubirDocumentoExpedienteForm({
  expedienteId,
  tiposDocumentales = [],
}: {
  expedienteId: string;
  tiposDocumentales?: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [archivos, setArchivos] = useState<File[]>([]);
  const [fechaDocumento, setFechaDocumento] = useState("");
  const [tipoDocumentalId, setTipoDocumentalId] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
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

  async function subir() {
    if (archivos.length === 0) return setError("Elija al menos un archivo.");
    setError(null);
    setSubiendo(true);
    try {
      const documentos = [];
      for (let i = 0; i < archivos.length; i++) {
        const file = archivos[i]!;
        setProgreso(`Subiendo "${file.name}" (${i + 1} de ${archivos.length})…`);
        const subido = await subirArchivoExpediente(expedienteId, file);
        const hashSha256 = await sha256Hex(file);
        documentos.push({ ...subido, hashSha256 });
      }
      setProgreso("Agregando al índice electrónico…");
      const resp = await fetch(`/api/correspondencia/expedientes/${expedienteId}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentos, fechaDocumento: fechaDocumento || undefined, tipoDocumentalId: tipoDocumentalId || undefined }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudieron agregar los documentos.");
      setArchivos([]);
      setFechaDocumento("");
      setTipoDocumentalId("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron agregar los documentos.");
    } finally {
      setSubiendo(false);
      setProgreso(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50">
        <Upload className="h-4 w-4" aria-hidden />
        Agregar archivos
        <input type="file" multiple accept={ACCEPT_DOCUMENTOS} className="hidden" onChange={(e) => agregarArchivos(e.target.files)} />
      </label>
      {archivos.length > 0 && (
        <ul className="space-y-1.5">
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
      {archivos.length > 0 && (
        <label className="flex w-fit items-center gap-2 text-sm text-stone-600">
          Fecha del documento
          <input
            type="date"
            value={fechaDocumento}
            onChange={(e) => setFechaDocumento(e.target.value)}
            className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-stone-400">Opcional — solo si es distinta de hoy</span>
        </label>
      )}
      {archivos.length > 0 && tiposDocumentales.length > 0 && (
        <label className="flex w-fit items-center gap-2 text-sm text-stone-600">
          Tipo documental
          <select
            value={tipoDocumentalId}
            onChange={(e) => setTipoDocumentalId(e.target.value)}
            className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
          >
            <option value="">— Sin especificar —</option>
            {tiposDocumentales.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
          <span className="text-xs text-stone-400">Opcional — según la TRD de este expediente, aplica a todos estos archivos</span>
        </label>
      )}
      {archivos.length > 0 && (
        <button
          type="button"
          onClick={subir}
          disabled={subiendo}
          className="inline-flex items-center gap-2 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-60"
        >
          {subiendo && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {subiendo ? (progreso ?? "Subiendo…") : `Agregar ${archivos.length} documento(s) al expediente`}
        </button>
      )}
    </div>
  );
}
