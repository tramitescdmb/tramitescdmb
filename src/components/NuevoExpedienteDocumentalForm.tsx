"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Loader2 } from "lucide-react";
import { Field, SectionHelp } from "@/components/Field";
import { PlantillaSelector, type PlantillaOpcion } from "@/components/PlantillaSelector";
import { contextoBase } from "@/lib/plantillas-marcadores";
import { BuscadorDependencia } from "@/components/BuscadorDependencia";
import { BuscadorSubserieTRD, type SerieBuscable } from "@/components/BuscadorSubserieTRD";
import { subirArchivoExpediente, sha256Hex } from "@/lib/uploads-client";
import { ACCEPT_DOCUMENTOS } from "@/lib/uploads-config";
import { filtrarLoteSGDEA, MAX_ARCHIVOS_LOTE, TAMANO_MAXIMO_SGDEA_MB } from "@/lib/uploads-sgdea";

type Dependencia = { id: string; nombre: string };

const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

export function NuevoExpedienteDocumentalForm({
  dependencias,
  series,
  plantillas = [],
  usuarioNombre = "",
}: {
  dependencias: Dependencia[];
  series: SerieBuscable[];
  plantillas?: PlantillaOpcion[];
  usuarioNombre?: string;
}) {
  const router = useRouter();
  const [dependenciaId, setDependenciaId] = useState(dependencias.length === 1 ? dependencias[0]!.id : "");
  const [serieId, setSerieId] = useState("");
  const [subserieId, setSubserieId] = useState("");
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function agregarArchivos(lista: FileList | null) {
    if (!lista) return;
    const { validos, error: err } = filtrarLoteSGDEA(Array.from(lista), archivos.length);
    if (err) setError(err);
    if (validos.length) setArchivos((prev) => [...prev, ...validos]);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      setProgreso("Abriendo el expediente…");
      const resp = await fetch("/api/correspondencia/expedientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asunto, descripcion, dependenciaId, serieId, subserieId }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudo abrir el expediente.");

      if (archivos.length > 0) {
        const documentos = [];
        for (let i = 0; i < archivos.length; i++) {
          const file = archivos[i]!;
          setProgreso(`Subiendo "${file.name}" (${i + 1} de ${archivos.length})…`);
          const subido = await subirArchivoExpediente(data.id, file);
          const hashSha256 = await sha256Hex(file);
          documentos.push({ ...subido, hashSha256 });
        }
        setProgreso("Agregando al índice electrónico…");
        const respDocs = await fetch(`/api/correspondencia/expedientes/${data.id}/documentos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentos }),
        });
        const dataDocs = await respDocs.json();
        if (!respDocs.ok) throw new Error(dataDocs.error || "El expediente se abrió, pero no se pudieron agregar los archivos.");
      }

      router.push(`/correspondencia/expedientes/${data.id}?ok=${encodeURIComponent(`Expediente ${data.numero} abierto.`)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el expediente.");
      setEnviando(false);
      setProgreso(null);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4 rounded-xl border border-stone-200 bg-white shadow-soft p-4">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {plantillas.length > 0 && (
        <PlantillaSelector
          plantillas={plantillas}
          contenidoActual={descripcion}
          asuntoActual={asunto}
          onCargar={setDescripcion}
          onCargarAsunto={setAsunto}
          contexto={{ ...contextoBase(), ASUNTO: asunto, FUNCIONARIO: usuarioNombre, DEPENDENCIA: dependencias.find((d) => d.id === dependenciaId)?.nombre ?? "" }}
        />
      )}
      <Field label="Asunto" required>
        <input name="asunto" required value={asunto} onChange={(e) => setAsunto(e.target.value)} className={inputCls} placeholder='Ej. "Contrato de prestación de servicios No. 045-2026"' />
      </Field>
      <Field label="Descripción">
        <textarea name="descripcion" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputCls} />
      </Field>

      <div className="border-t border-stone-100 pt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Archivos</h3>
        <SectionHelp>
          Opcional — adjunte aquí el o los primeros documentos del expediente. Puede agregar más después de abrirlo.
        </SectionHelp>
        <p className="mb-2 text-xs text-stone-400">Hasta {MAX_ARCHIVOS_LOTE} archivos, cada uno de máximo {TAMANO_MAXIMO_SGDEA_MB} MB.</p>
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-stone-200 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50">
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

      <div className="border-t border-stone-100 pt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Dependencia y clasificación (TRD)</h3>
        <SectionHelp>Opcional clasificar por serie/subserie — busque por código, nombre o dependencia.</SectionHelp>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Dependencia" required>
            <BuscadorDependencia dependencias={dependencias} value={dependenciaId} onChange={setDependenciaId} />
            <input type="hidden" name="dependenciaId" value={dependenciaId} required />
          </Field>
          <Field label="Serie / subserie (TRD)">
            <BuscadorSubserieTRD
              series={series}
              serieId={serieId}
              subserieId={subserieId}
              dependenciaPreferidaId={dependenciaId || null}
              onChange={(s, ss) => { setSerieId(s); setSubserieId(ss); }}
              nameSerie="serieId"
              nameSubserie="subserieId"
            />
          </Field>
        </div>
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-60"
      >
        {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {enviando ? (progreso ?? "Abriendo…") : "Abrir expediente"}
      </button>
    </form>
  );
}
