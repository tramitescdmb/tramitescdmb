"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X, ShieldCheck } from "lucide-react";
import { subirArchivoDirecto } from "@/lib/uploads-client";
import { ACCEPT_DOCUMENTOS, extensionPermitida, mensajeTipoNoPermitido } from "@/lib/uploads-config";

type Dependencia = { id: string; nombre: string };
type Subserie = { id: string; codigo: string; nombre: string };
type Serie = { id: string; codigo: string; nombre: string; subseries: Subserie[] };

async function sha256Hex(file: File): Promise<string | null> {
  try {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

export function MemorandoForm({
  dependencias,
  series,
  dependenciaOrigenSugerida,
}: {
  dependencias: Dependencia[];
  series: Serie[];
  dependenciaOrigenSugerida: string | null;
}) {
  const router = useRouter();
  const [dependenciaOrigenId, setDependenciaOrigenId] = useState(dependenciaOrigenSugerida ?? "");
  const [dependenciaDestinoId, setDependenciaDestinoId] = useState("");
  const [asunto, setAsunto] = useState("");
  const [contenido, setContenido] = useState("");
  const [folios, setFolios] = useState(1);
  const [serieId, setSerieId] = useState("");
  const [subserieId, setSubserieId] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subseries = useMemo(() => series.find((s) => s.id === serieId)?.subseries ?? [], [series, serieId]);

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

  async function radicarYFirmar() {
    setError(null);
    if (!asunto.trim()) return setError("El asunto es obligatorio.");
    if (!contenido.trim()) return setError("El contenido del memorando es obligatorio: es lo que queda firmado.");
    if (!dependenciaOrigenId) return setError("Indique la dependencia de origen (quién firma este memorando).");
    if (!dependenciaDestinoId) return setError("Indique la dependencia de destino.");
    if (dependenciaOrigenId === dependenciaDestinoId) return setError("La dependencia de origen y la de destino no pueden ser la misma.");
    setEnviando(true);
    try {
      const folder = crypto.randomUUID();
      const documentos: { path: string; nombre: string; mimeType: string; tamanoBytes: number; hashSha256: string | null }[] = [];
      for (const file of archivos) {
        const subido = await subirArchivoDirecto(folder, file, { nuevo: true });
        const hashSha256 = await sha256Hex(file);
        documentos.push({ path: subido.path, nombre: subido.nombre, mimeType: subido.mimeType, tamanoBytes: subido.tamanoBytes, hashSha256 });
      }

      const resp = await fetch("/api/correspondencia/radicar-interna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asunto: asunto.trim(),
          contenido: contenido.trim(),
          folios,
          dependenciaOrigenId,
          dependenciaDestinoId,
          serieId: serieId || null,
          subserieId: subserieId || null,
          documentos,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudo radicar.");
      router.push(`/correspondencia/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo radicar el memorando.");
      setEnviando(false);
    }
  }

  const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";
  const labelCls = "mb-1 block text-xs font-medium text-stone-600";

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Memorando</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className={labelCls}>Dependencia de origen *</span>
            <select value={dependenciaOrigenId} onChange={(e) => setDependenciaOrigenId(e.target.value)} className={inputCls}>
              <option value="">— Seleccione —</option>
              {dependencias.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Dependencia de destino *</span>
            <select value={dependenciaDestinoId} onChange={(e) => setDependenciaDestinoId(e.target.value)} className={inputCls}>
              <option value="">— Seleccione —</option>
              {dependencias.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
            </select>
          </label>
          <label>
            <span className={labelCls}>N.º de folios</span>
            <input type="number" min={1} value={folios} onChange={(e) => setFolios(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Serie documental (TRD)</span>
            <select value={serieId} onChange={(e) => { setSerieId(e.target.value); setSubserieId(""); }} className={inputCls}>
              <option value="">— Sin clasificar —</option>
              {series.map((s) => (<option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>))}
            </select>
          </label>
          {subseries.length > 0 && (
            <label>
              <span className={labelCls}>Subserie</span>
              <select value={subserieId} onChange={(e) => setSubserieId(e.target.value)} className={inputCls}>
                <option value="">— Seleccione —</option>
                {subseries.map((ss) => (<option key={ss.id} value={ss.id}>{ss.codigo} — {ss.nombre}</option>))}
              </select>
            </label>
          )}
          <label className="sm:col-span-2 lg:col-span-4">
            <span className={labelCls}>Asunto *</span>
            <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={inputCls} />
          </label>
          <label className="sm:col-span-2 lg:col-span-4">
            <span className={labelCls}>Contenido *</span>
            <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={8} className={inputCls} placeholder="Cuerpo del memorando…" />
            <p className="mt-1 text-[11px] text-stone-400">Este texto, junto con el asunto y el radicado, es lo que queda firmado con hash SHA-256.</p>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Documentos adjuntos</h2>
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50">
          <Upload className="h-4 w-4" aria-hidden />
          Agregar archivos
          <input type="file" multiple accept={ACCEPT_DOCUMENTOS} className="hidden" onChange={(e) => agregarArchivos(e.target.files)} />
        </label>
        {archivos.length > 0 && (
          <ul className="mt-3 space-y-1.5">
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
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={radicarYFirmar}
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-md bg-cdmb-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-60"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
          {enviando ? "Radicando y firmando…" : "Radicar y firmar"}
        </button>
        <span className="text-xs text-stone-400">Se asigna consecutivo y se firma electrónicamente en el mismo paso.</span>
      </div>
    </div>
  );
}
