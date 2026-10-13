"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { comprimirParaContratacion } from "@/lib/compresion-cliente";
import { subirArchivoContrato, sha256Hex } from "@/lib/uploads-client";
import { TAMANO_MAXIMO_CONTRATACION_BYTES, mensajeArchivoDemasiadoGrandeContratacion } from "@/lib/uploads-config";
import { esDocumentoModificacion } from "@/lib/modificaciones-contrato";
import { CamposModificacionContrato, MODIFICACION_VACIA, cuerpoModificacion, faltaEnModificacion, type ValorModificacion } from "@/components/CamposModificacionContrato";

type EtapaContratacion = "PRECONTRACTUAL" | "CONTRACTUAL" | "POSTCONTRACTUAL";

export function SubirDocumentosContratoForm({
  expedienteId,
  etapa,
  categoriasSugeridas,
  fechaTerminacionActual = null,
}: {
  expedienteId: string;
  etapa: EtapaContratacion;
  categoriasSugeridas: string[];
  fechaTerminacionActual?: string | null;
}) {
  const router = useRouter();
  const datalistId = useId();
  const [categoria, setCategoria] = useState("");
  const [requiereFirma, setRequiereFirma] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esModificacion = esDocumentoModificacion(categoria);
  const [modificacion, setModificacion] = useState<ValorModificacion>(MODIFICACION_VACIA);

  async function subir(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (esModificacion) {
      const falta = faltaEnModificacion(modificacion);
      if (falta) {
        setError(falta);
        return;
      }
      if (files.length > 1) {
        setError("Cargue un solo archivo por modificación.");
        return;
      }
    }
    setSubiendo(true);
    setError(null);
    try {
      const lista = Array.from(files);
      for (let i = 0; i < lista.length; i++) {
        const original = lista[i]!;
        setProgreso(`Comprimiendo "${original.name}" (${i + 1} de ${lista.length})…`);
        const comprimido = await comprimirParaContratacion(original);
        if (comprimido.size > TAMANO_MAXIMO_CONTRATACION_BYTES) {
          throw new Error(mensajeArchivoDemasiadoGrandeContratacion(original.name));
        }
        setProgreso(`Subiendo "${original.name}" (${i + 1} de ${lista.length})…`);
        const subido = await subirArchivoContrato(expedienteId, comprimido);
        const hashSha256 = await sha256Hex(comprimido);
        const res = await fetch(`/api/contratacion/expedientes/${expedienteId}/documentos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            etapa,
            categoria: categoria || null,
            nombre: subido.nombre,
            storagePath: subido.path,
            mimeType: subido.mimeType,
            tamanoBytes: subido.tamanoBytes,
            hashSha256,
            requiereFirma,
            modificacion: esModificacion ? cuerpoModificacion(modificacion) : undefined,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `No se pudo registrar "${original.name}".`);
        }
      }
      setCategoria("");
      setModificacion(MODIFICACION_VACIA);
      setRequiereFirma(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setSubiendo(false);
      setProgreso(null);
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50/60 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          list={datalistId}
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          placeholder="Categoría del documento (opcional)"
          className="min-w-[220px] flex-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
        />
        <datalist id={datalistId}>
          {categoriasSugeridas.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      {esModificacion && (
        <div className="mb-2">
          <CamposModificacionContrato valor={modificacion} onChange={setModificacion} fechaTerminacionActual={fechaTerminacionActual} />
        </div>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-stone-600">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={requiereFirma} onChange={(e) => setRequiereFirma(e.target.checked)} />
          Requiere firma electrónica
        </label>
      </div>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50">
        <UploadCloud className="h-4 w-4" aria-hidden />
        {subiendo ? progreso ?? "Subiendo…" : "Elegir archivo(s) — máximo 2MB c/u"}
        <input type="file" multiple className="hidden" disabled={subiendo} onChange={(e) => subir(e.target.files)} />
      </label>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
