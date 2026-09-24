"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/Field";
import { subirArchivoDirecto, sha256Hex } from "@/lib/uploads-client";
import { ACCEPT_DOCUMENTOS } from "@/lib/uploads-config";
import { IconX } from "@/components/icons";
import { Receipt, FileText, Upload, CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/Spinner";

const iconSm = "h-4 w-4";
const CLAVE_OTROS = "__otros__";

function esDocumentoDePago(nombre: string) {
  return /\bpago\b|\bfactura\b/i.test(nombre);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function BotonSubir({ onClick, subiendo, deshabilitado }: { onClick: () => void; subiendo: boolean; deshabilitado: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      className="inline-flex flex-none items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1 text-xs font-medium text-white hover:bg-cdmb-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {subiendo ? <Spinner /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
      {subiendo ? "Subiendo…" : "Subir"}
    </button>
  );
}

export function SubirDocumentoPasoForm({
  expedienteId,
  pasoNumero,
  documentosDelPaso,
  documentosCargados = [],
}: {
  expedienteId: string;
  pasoNumero: number;
  documentosDelPaso: string[];
  documentosCargados?: string[];
}) {
  const router = useRouter();
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [archivosPorDoc, setArchivosPorDoc] = useState<Record<string, File | null>>({});
  const [archivosExtra, setArchivosExtra] = useState<File[]>([]);
  const [requiereFirma, setRequiereFirma] = useState(true);
  const docInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const extraInputRef = useRef<HTMLInputElement | null>(null);

  function quitarArchivoDoc(nombreDoc: string) {
    setArchivosPorDoc((prev) => ({ ...prev, [nombreDoc]: null }));
    const input = docInputRefs.current[nombreDoc];
    if (input) input.value = "";
  }

  async function subir(clave: string, archivos: File[], descripcion: (file: File) => string, alTerminar: () => void) {
    setErrores((prev) => ({ ...prev, [clave]: "" }));
    setSubiendo(clave);
    try {
      const datos = [];
      for (const file of archivos) {
        const subido = await subirArchivoDirecto(expedienteId, file);
        const hashSha256 = await sha256Hex(file);
        datos.push({ ...subido, descripcion: descripcion(file), hashSha256, requiereFirma });
      }
      const res = await fetch(`/api/expedientes/${expedienteId}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pasoNumero, archivos: datos }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo guardar el documento.");
      }
      alTerminar();
      router.refresh();
    } catch (err) {
      setErrores((prev) => ({ ...prev, [clave]: err instanceof Error ? err.message : "Ocurrió un error inesperado. Intente nuevamente." }));
    } finally {
      setSubiendo(null);
    }
  }

  const ocupado = subiendo !== null;

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-xs text-stone-600">
        <input
          type="checkbox"
          checked={requiereFirma}
          onChange={(e) => setRequiereFirma(e.target.checked)}
          disabled={ocupado}
          className="rounded border-stone-300"
        />
        Los documentos que se suban requieren firma electrónica
      </label>

      {documentosDelPaso.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-stone-500">
            Un espacio por cada documento que este paso indica en el procedimiento oficial.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {documentosDelPaso.map((nombreDoc) => {
              const esPago = esDocumentoDePago(nombreDoc);
              const archivo = archivosPorDoc[nombreDoc] ?? null;
              const cargado = documentosCargados.includes(nombreDoc);
              return (
                <Field key={nombreDoc} label={nombreDoc} icon={esPago ? <Receipt className={iconSm} /> : <FileText className={iconSm} />}>
                  {cargado && !archivo && (
                    <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Ya cargado en este paso
                    </p>
                  )}
                  <input
                    ref={(el) => {
                      docInputRefs.current[nombreDoc] = el;
                    }}
                    type="file"
                    accept={ACCEPT_DOCUMENTOS}
                    disabled={ocupado}
                    onChange={(e) => setArchivosPorDoc((prev) => ({ ...prev, [nombreDoc]: e.target.files?.[0] ?? null }))}
                    className={`block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium ${
                      esPago ? "file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100" : "file:bg-cdmb-50 file:text-cdmb-700 hover:file:bg-cdmb-100"
                    }`}
                  />
                  {archivo && (
                    <div className={`mt-1.5 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs ${esPago ? "bg-amber-50 text-amber-800" : "bg-cdmb-50 text-cdmb-800"}`}>
                      <span className="min-w-0 flex-1 truncate">
                        {archivo.name} <span className="opacity-70">({formatBytes(archivo.size)})</span>
                      </span>
                      <BotonSubir
                        subiendo={subiendo === nombreDoc}
                        deshabilitado={ocupado}
                        onClick={() => subir(nombreDoc, [archivo], () => nombreDoc, () => quitarArchivoDoc(nombreDoc))}
                      />
                      <button
                        type="button"
                        onClick={() => quitarArchivoDoc(nombreDoc)}
                        disabled={ocupado}
                        title="Quitar este archivo"
                        className="flex-none rounded p-0.5 hover:bg-white/60 hover:text-red-600"
                      >
                        <IconX className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {errores[nombreDoc] && <p className="mt-1 text-xs text-red-600">{errores[nombreDoc]}</p>}
                </Field>
              );
            })}
          </div>
        </div>
      )}

      <Field
        label={documentosDelPaso.length > 0 ? "Otros documentos de este paso" : "Adjuntar documento de este paso"}
        help="Cualquier otro soporte que no esté incluido en la lista anterior. Pueden seleccionarse varios archivos. Formatos aceptados: PDF, Word, Excel o imagen (JPG/PNG)."
      >
        <input
          ref={extraInputRef}
          type="file"
          accept={ACCEPT_DOCUMENTOS}
          multiple
          disabled={ocupado}
          onChange={(e) => {
            const nuevos = e.target.files ? Array.from(e.target.files) : [];
            if (nuevos.length > 0) setArchivosExtra((prev) => [...prev, ...nuevos]);
            if (extraInputRef.current) extraInputRef.current.value = "";
          }}
          className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
        />
        {archivosExtra.length > 0 && (
          <div className="mt-1.5 space-y-1">
            <ul className="space-y-1">
              {archivosExtra.map((archivo, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md bg-stone-100 px-2.5 py-1.5 text-xs text-stone-700">
                  <FileText className="h-3.5 w-3.5 flex-none text-stone-500" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {archivo.name} <span className="text-stone-400">({formatBytes(archivo.size)})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setArchivosExtra((prev) => prev.filter((_, j) => j !== i))}
                    disabled={ocupado}
                    title="Quitar este archivo"
                    className="flex-none rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-red-600"
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <BotonSubir
              subiendo={subiendo === CLAVE_OTROS}
              deshabilitado={ocupado}
              onClick={() =>
                subir(CLAVE_OTROS, archivosExtra, () => "Documento adicional aportado durante este paso.", () => setArchivosExtra([]))
              }
            />
          </div>
        )}
        {errores[CLAVE_OTROS] && <p className="mt-1 text-xs text-red-600">{errores[CLAVE_OTROS]}</p>}
      </Field>
    </div>
  );
}
