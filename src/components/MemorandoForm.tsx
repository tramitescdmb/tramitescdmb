"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X, ShieldCheck } from "lucide-react";
import { subirArchivoDirecto, subirDocumentosConProgreso } from "@/lib/uploads-client";
import { ACCEPT_DOCUMENTOS, extensionPermitida, mensajeTipoNoPermitido } from "@/lib/uploads-config";
import { Field, SectionHelp } from "@/components/Field";
import { BarraProgresoEnvio } from "@/components/BarraProgresoEnvio";

type Dependencia = { id: string; nombre: string };
type Subserie = { id: string; codigo: string; nombre: string };
type Serie = { id: string; codigo: string; nombre: string; dependenciaId: string | null; subseries: Subserie[] };

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
  const [progreso, setProgreso] = useState<{ pct: number; texto: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const seriesDeDependencia = useMemo(() => {
    const sinDependencia = series.filter((s) => !s.dependenciaId);
    if (!dependenciaOrigenId) return sinDependencia;
    return [...series.filter((s) => s.dependenciaId === dependenciaOrigenId), ...sinDependencia];
  }, [series, dependenciaOrigenId]);
  const subseries = useMemo(() => seriesDeDependencia.find((s) => s.id === serieId)?.subseries ?? [], [seriesDeDependencia, serieId]);

  function cambiarDependenciaOrigen(nuevoId: string) {
    setDependenciaOrigenId(nuevoId);
    setSerieId("");
    setSubserieId("");
  }

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
    setProgreso({ pct: 0, texto: "Preparando…" });
    try {
      const folder = crypto.randomUUID();
      const documentos = await subirDocumentosConProgreso(
        archivos,
        (f, file) => subirArchivoDirecto(f, file, { nuevo: true }),
        folder,
        (pct, texto) => setProgreso({ pct, texto })
      );

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
      setProgreso({ pct: 100, texto: "Listo." });
      router.push(`/correspondencia/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo radicar el memorando.");
      setProgreso(null);
      setEnviando(false);
    }
  }

  const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Memorando</h2>
        <SectionHelp>
          Comunicación interna entre dependencias — no sale de la entidad. Queda firmada con hash al radicarla.
        </SectionHelp>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Dependencia de origen" required help="Quién firma este memorando.">
            <select value={dependenciaOrigenId} onChange={(e) => cambiarDependenciaOrigen(e.target.value)} className={inputCls}>
              <option value="">— Seleccione —</option>
              {dependencias.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
            </select>
          </Field>
          <Field label="Dependencia de destino" required>
            <select value={dependenciaDestinoId} onChange={(e) => setDependenciaDestinoId(e.target.value)} className={inputCls}>
              <option value="">— Seleccione —</option>
              {dependencias.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
            </select>
          </Field>
          <Field label="N.º de folios">
            <input type="number" min={1} value={folios} onChange={(e) => setFolios(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Asunto" required>
              <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Contenido" required>
              <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={8} className={inputCls} placeholder="Cuerpo del memorando…" />
            </Field>
          </div>
        </div>

        <div className="mt-4 border-t border-stone-100 pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Clasificación (TRD)</h3>
          <SectionHelp>
            Las series disponibles dependen de la dependencia de origen elegida arriba. Sin elegirla, solo queda
            &quot;Sin clasificar&quot;.
          </SectionHelp>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Serie documental (TRD)">
              <select value={serieId} onChange={(e) => { setSerieId(e.target.value); setSubserieId(""); }} className={inputCls}>
                <option value="">— Sin clasificar —</option>
                {seriesDeDependencia.map((s) => (<option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>))}
              </select>
            </Field>
            <Field label="Subserie">
              <select value={subserieId} onChange={(e) => setSubserieId(e.target.value)} className={inputCls} disabled={!subseries.length}>
                <option value="">{subseries.length ? "— Seleccione —" : "—"}</option>
                {subseries.map((ss) => (<option key={ss.id} value={ss.id}>{ss.codigo} — {ss.nombre}</option>))}
              </select>
            </Field>
          </div>
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

      {progreso && <BarraProgresoEnvio pct={progreso.pct} texto={progreso.texto} />}

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
