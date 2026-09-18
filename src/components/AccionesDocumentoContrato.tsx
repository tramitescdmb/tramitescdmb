"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Pencil, Upload, X } from "lucide-react";
import { subirArchivoContrato, sha256Hex } from "@/lib/uploads-client";

/** EXCEPCIÓN deliberada de este módulo: editar/eliminar aquí NO deja ninguna traza en la bitácora del
 * expediente — solo visible/habilitado para Administrador/Jefe de Contratación (el gate real está en
 * el servidor, esto solo evita mostrar el botón a quien de todas formas recibiría 403).
 *
 * "Editar" abre un modal con dos acciones independientes: cambiar el nombre (como antes), o
 * REEMPLAZAR el archivo real — antes solo existía lo primero, y el usuario probó que cambiar
 * el "nombre" no tocaba el PDF/imagen subido. Reemplazar borra el archivo anterior del storage
 * e invalida cualquier firma/solicitud previa (ver editarDocumentoContratoSinTraza): estaban
 * sobre un contenido que ya no existe.
 */
export function EditarEliminarDocumentoContrato({
  documentoId,
  expedienteId,
  nombreActual,
  requiereFirmaActual = false,
}: {
  documentoId: string;
  expedienteId: string;
  nombreActual: string;
  /** Antes solo se podía marcar "requiere firma" al SUBIR el documento — si se olvidaba, no había
   * forma de corregirlo después ni de habilitar la asignación de firmantes. */
  requiereFirmaActual?: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(nombreActual);
  const [requiereFirma, setRequiereFirma] = useState(requiereFirmaActual);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function guardarCambios() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/documentos/${documentoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() || nombreActual, requiereFirma }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo editar.");
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  async function reemplazarArchivo(file: File) {
    setCargando(true);
    setError(null);
    try {
      const subido = await subirArchivoContrato(expedienteId, file);
      const hashSha256 = await sha256Hex(file);
      const res = await fetch(`/api/contratacion/documentos/${documentoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archivo: { storagePath: subido.path, mimeType: subido.mimeType, tamanoBytes: subido.tamanoBytes, hashSha256 },
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

  async function eliminar() {
    if (!window.confirm(`¿Eliminar "${nombreActual}"? Esta acción no queda registrada en el historial del expediente.`)) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/documentos/${documentoId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo eliminar.");
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
        title="Editar (Administrador/Jefe de Contratación — sin traza)"
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        <Pencil className="h-3 w-3" aria-hidden />
      </button>
      <button
        type="button"
        onClick={eliminar}
        disabled={cargando}
        title="Eliminar (Administrador/Jefe de Contratación — sin traza)"
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" aria-hidden />
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
