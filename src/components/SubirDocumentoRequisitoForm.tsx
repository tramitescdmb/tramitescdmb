"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { comprimirParaContratacion } from "@/lib/compresion-cliente";
import { subirArchivoContrato, sha256Hex } from "@/lib/uploads-client";
import { TAMANO_MAXIMO_CONTRATACION_BYTES, mensajeArchivoDemasiadoGrandeContratacion } from "@/lib/uploads-config";

type EtapaContratacion = "PRECONTRACTUAL" | "CONTRACTUAL" | "POSTCONTRACTUAL";

/**
 * Sube UN archivo atado a un requisito puntual del catálogo (checklist) — a
 * diferencia de SubirDocumentosContratoForm (multi-archivo libre, para lo que
 * no está en el catálogo), acá ya se sabe qué documento es.
 *
 * El nombre que queda guardado (`DocumentoContrato.nombre`) es el del
 * PROCEDIMIENTO, no el del archivo que subió el usuario (ej. "IMG_2384.pdf")
 * — así se ve/exporta/previsualiza siempre con el nombre real del documento
 * exigido por el Manual, sin depender de cómo llamó el archivo quien lo subió.
 */
export function SubirDocumentoRequisitoForm({
  expedienteId,
  etapa,
  requisitoId,
  requisitoNombre,
  firmadoEnSecopSugerido,
  periodoMes,
  periodoEventualId,
}: {
  expedienteId: string;
  etapa: EtapaContratacion;
  requisitoId: string;
  requisitoNombre: string;
  firmadoEnSecopSugerido: boolean;
  /** Requisito que se entrega por periodos (informe de supervisión): a qué periodo corresponde
   * este archivo — un mes "AAAA-MM" o un espacio eventual. El servidor arma el nombre final. */
  periodoMes?: string;
  periodoEventualId?: string;
}) {
  const router = useRouter();
  const [requiereFirma, setRequiereFirma] = useState(false);
  const [firmadoEnSecop, setFirmadoEnSecop] = useState(firmadoEnSecopSugerido);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setSubiendo(true);
    setError(null);
    try {
      const comprimido = await comprimirParaContratacion(file);
      if (comprimido.size > TAMANO_MAXIMO_CONTRATACION_BYTES) {
        throw new Error(mensajeArchivoDemasiadoGrandeContratacion(file.name));
      }
      const subido = await subirArchivoContrato(expedienteId, comprimido);
      const hashSha256 = await sha256Hex(comprimido);
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etapa,
          requisitoId,
          nombre: requisitoNombre,
          storagePath: subido.path,
          mimeType: subido.mimeType,
          tamanoBytes: subido.tamanoBytes,
          hashSha256,
          requiereFirma,
          firmadoEnSecop,
          periodoMes,
          periodoEventualId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo registrar el documento.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2 text-[10px] text-stone-500">
        <label className="flex items-center gap-1" title="El Jefe de Contratación o el Supervisor asignado podrá revisarlo y estamparle la firma electrónica">
          <input type="checkbox" checked={requiereFirma} disabled={firmadoEnSecop} onChange={(e) => setRequiereFirma(e.target.checked)} />
          Requiere firma
        </label>
        <label className="flex items-center gap-1" title="Ya viene firmado o publicado en SECOP II — no hace falta volver a firmarlo aquí">
          <input
            type="checkbox"
            checked={firmadoEnSecop}
            onChange={(e) => {
              setFirmadoEnSecop(e.target.checked);
              if (e.target.checked) setRequiereFirma(false);
            }}
          />
          Firmado en SECOP II
        </label>
      </div>
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-cdmb-200 bg-cdmb-50 px-2.5 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-100">
        <UploadCloud className="h-3.5 w-3.5" aria-hidden />
        {subiendo ? "Subiendo…" : "Subir"}
        <input type="file" className="hidden" disabled={subiendo} onChange={(e) => subir(e.target.files)} />
      </label>
      {error && <span className="max-w-[220px] text-right text-[11px] text-red-700">{error}</span>}
    </div>
  );
}
