"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Upload, X } from "lucide-react";
import { subirArchivoDirecto, sha256Hex } from "@/lib/uploads-client";

/**
 * Editar un documento de un expediente de trámites: nombre, si requiere firma, o reemplazar el
 * archivo real. Misma regla de acceso que eliminar (`puedeEditar`, calculado por el caller con
 * `puedeIntentarEliminarDocumento`): dentro de la etapa abierta puede quien lo subió o un
 * administrador; con la etapa ya cerrada, solo un administrador y con el oficio de solicitud del
 * Subdirector. Reemplazar el archivo invalida cualquier firma o solicitud de firma ya registrada
 * sobre él — quedarían sobre un contenido que ya no existe.
 */
export function EditarDocumentoBoton({
  documentoId,
  expedienteId,
  nombreActual,
  requiereFirmaActual,
  etapaAbierta,
  puedeEditar,
}: {
  documentoId: string;
  expedienteId: string;
  nombreActual: string;
  requiereFirmaActual: boolean;
  etapaAbierta: boolean;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(nombreActual);
  const [requiereFirma, setRequiereFirma] = useState(requiereFirmaActual);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!puedeEditar) return null;

  function pedirOficio(): string | null {
    if (etapaAbierta) return "";
    const respuesta = window.prompt(
      `"${nombreActual}" quedó en una etapa que ya se cerró. Para editarlo, indique el número o referencia del oficio de solicitud del Subdirector (obligatorio):`
    );
    if (respuesta === null) return null;
    const oficio = respuesta.trim();
    if (!oficio) {
      window.alert("Se requiere el oficio de solicitud del Subdirector para editar un documento de una etapa ya cerrada.");
      return null;
    }
    return oficio;
  }

  async function guardarCambios() {
    const oficio = pedirOficio();
    if (oficio === null) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/documentos/${documentoId}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() || nombreActual, requiereFirma, oficio }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo editar el documento.");
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  async function reemplazarArchivo(file: File) {
    const oficio = pedirOficio();
    if (oficio === null) return;
    setCargando(true);
    setError(null);
    try {
      const subido = await subirArchivoDirecto(expedienteId, file);
      const hashSha256 = await sha256Hex(file);
      const res = await fetch(`/api/documentos/${documentoId}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archivo: { storagePath: subido.path, mimeType: subido.mimeType, tamanoBytes: subido.tamanoBytes, hashSha256 },
          oficio,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo reemplazar el archivo.");
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={etapaAbierta ? "Editar documento" : "Editar documento (requiere oficio — etapa cerrada)"}
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        <Pencil className="h-3 w-3" aria-hidden />
      </button>

      {abierto && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Editar documento</h3>
              <button type="button" onClick={() => setAbierto(false)} className="text-stone-400 hover:text-stone-600">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <label className="block text-xs font-medium text-stone-600">
              Nombre
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
              />
            </label>

            <label className="mt-3 flex items-center gap-2 text-xs font-medium text-stone-600">
              <input
                type="checkbox"
                checked={requiereFirma}
                onChange={(e) => setRequiereFirma(e.target.checked)}
                className="rounded border-stone-300"
              />
              Requiere firma electrónica
            </label>

            <button
              type="button"
              onClick={guardarCambios}
              disabled={cargando}
              className="mt-3 w-full rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
            >
              Guardar cambios
            </button>

            <div className="mt-4 border-t border-stone-100 pt-3">
              <p className="mb-1.5 text-xs font-medium text-stone-600">Reemplazar archivo</p>
              <p className="mb-2 text-[11px] text-stone-400">
                Sube un archivo nuevo en lugar del actual. El archivo anterior se borra y cualquier firma ya
                registrada sobre él queda invalidada (deberá volver a firmarse).
              </p>
              <input
                ref={fileRef}
                type="file"
                onChange={(e) => e.target.files?.[0] && reemplazarArchivo(e.target.files[0])}
                disabled={cargando}
                className="block w-full text-xs text-stone-600 file:mr-2 file:rounded-md file:border-0 file:bg-stone-100 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-stone-700 hover:file:bg-stone-200"
              />
              {cargando && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-stone-400">
                  <Upload className="h-3 w-3 animate-pulse" aria-hidden /> Subiendo…
                </p>
              )}
            </div>

            {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
          </div>
        </div>
      )}
    </span>
  );
}
