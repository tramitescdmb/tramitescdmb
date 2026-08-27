"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/Field";
import { subirArchivoDirecto } from "@/lib/uploads-client";
import { IconX } from "@/components/icons";
import { Spinner } from "@/components/Spinner";

function esDocumentoDePago(nombre: string) {
  return /\bpago\b|\bfactura\b/i.test(nombre);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SubirDocumentoPasoForm({
  expedienteId,
  pasoNumero,
  documentosDelPaso,
}: {
  expedienteId: string;
  pasoNumero: number;
  documentosDelPaso: string[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [archivosPorDoc, setArchivosPorDoc] = useState<Record<string, File | null>>({});
  const [archivosExtra, setArchivosExtra] = useState<File[]>([]);
  const docInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const extraInputRef = useRef<HTMLInputElement | null>(null);

  function quitarArchivoDoc(nombreDoc: string) {
    setArchivosPorDoc((prev) => ({ ...prev, [nombreDoc]: null }));
    const input = docInputRefs.current[nombreDoc];
    if (input) input.value = "";
  }

  function quitarArchivoExtra(index: number) {
    setArchivosExtra((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const hayArchivosPorDoc = documentosDelPaso.some((d) => archivosPorDoc[d]);
    if (!hayArchivosPorDoc && archivosExtra.length === 0) {
      setError("Debe seleccionarse al menos un archivo.");
      return;
    }

    setSubmitting(true);
    try {
      const archivos: Array<{ path: string; nombre: string; mimeType: string; tamanoBytes: number; descripcion?: string }> = [];

      for (const nombreDoc of documentosDelPaso) {
        const file = archivosPorDoc[nombreDoc];
        if (!file) continue;
        setProgreso(`Subiendo "${file.name}"…`);
        const subido = await subirArchivoDirecto(expedienteId, file);
        archivos.push({ ...subido, descripcion: nombreDoc });
      }
      for (const file of archivosExtra) {
        setProgreso(`Subiendo "${file.name}"…`);
        const subido = await subirArchivoDirecto(expedienteId, file);
        archivos.push({ ...subido, descripcion: "Documento adicional aportado durante este paso." });
      }

      setProgreso("Guardando…");
      const res = await fetch(`/api/expedientes/${expedienteId}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pasoNumero, archivos }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo guardar el documento.");
      }

      setArchivosPorDoc({});
      setArchivosExtra([]);
      for (const nombreDoc of documentosDelPaso) {
        const input = docInputRefs.current[nombreDoc];
        if (input) input.value = "";
      }
      if (extraInputRef.current) extraInputRef.current.value = "";
      setProgreso(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado. Intente nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {documentosDelPaso.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-stone-500">
            Un espacio por cada documento que este paso indica en el procedimiento oficial.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {documentosDelPaso.map((nombreDoc) => {
              const esPago = esDocumentoDePago(nombreDoc);
              const archivo = archivosPorDoc[nombreDoc] ?? null;
              return (
                <Field key={nombreDoc} label={`${esPago ? "💰" : "📄"} ${nombreDoc}`}>
                  <input
                    ref={(el) => {
                      docInputRefs.current[nombreDoc] = el;
                    }}
                    type="file"
                    disabled={submitting}
                    onChange={(e) =>
                      setArchivosPorDoc((prev) => ({ ...prev, [nombreDoc]: e.target.files?.[0] ?? null }))
                    }
                    className={`block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium ${
                      esPago
                        ? "file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                        : "file:bg-cdmb-50 file:text-cdmb-700 hover:file:bg-cdmb-100"
                    }`}
                  />
                  {archivo && (
                    <div
                      className={`mt-1.5 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs ${
                        esPago ? "bg-amber-50 text-amber-800" : "bg-cdmb-50 text-cdmb-800"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {archivo.name} <span className="opacity-70">({formatBytes(archivo.size)})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => quitarArchivoDoc(nombreDoc)}
                        disabled={submitting}
                        title="Quitar este archivo"
                        className="flex-none rounded p-0.5 hover:bg-white/60 hover:text-red-600"
                      >
                        <IconX className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </Field>
              );
            })}
          </div>
        </div>
      )}

      <Field
        label={documentosDelPaso.length > 0 ? "Otros documentos de este paso" : "Adjuntar documento de este paso"}
        help="Cualquier otro soporte que no esté incluido en la lista anterior. Pueden seleccionarse varios archivos."
      >
        <input
          ref={extraInputRef}
          type="file"
          multiple
          disabled={submitting}
          onChange={(e) => {
            const nuevos = e.target.files ? Array.from(e.target.files) : [];
            if (nuevos.length > 0) setArchivosExtra((prev) => [...prev, ...nuevos]);
            if (extraInputRef.current) extraInputRef.current.value = "";
          }}
          className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
        />
        {archivosExtra.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {archivosExtra.map((archivo, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md bg-stone-100 px-2.5 py-1.5 text-xs text-stone-700">
                <span className="min-w-0 flex-1 truncate">
                  📄 {archivo.name} <span className="text-stone-400">({formatBytes(archivo.size)})</span>
                </span>
                <button
                  type="button"
                  onClick={() => quitarArchivoExtra(i)}
                  disabled={submitting}
                  title="Quitar este archivo"
                  className="flex-none rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-red-600"
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-transform hover:bg-stone-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
        >
          {submitting && <Spinner />}
          {submitting ? "Subiendo…" : "Subir"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {progreso && (
          <p className="flex items-center gap-2 text-xs text-cdmb-700">
            <span className="h-3 w-3 flex-none animate-spin rounded-full border-2 border-cdmb-600 border-t-transparent" />
            {progreso}
          </p>
        )}
      </div>
    </form>
  );
}
