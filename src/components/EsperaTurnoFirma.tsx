import { Lock } from "lucide-react";
import { BotonAvisarFirmantes } from "@/components/BotonAvisarFirmantes";
import { formatearFechaHora } from "@/lib/fecha";

type Anterior = { nombre: string; recordadoEn?: Date | string | null };

export function textoEsperaA(esperaA: { nombre: string }[]): string {
  return esperaA.length ? `Antes firma: ${esperaA.map((p) => p.nombre).join(", ")}` : "Esperando turno";
}

export function textoRecordatorio(recordadoPor: { nombre: string } | null | undefined, recordadoEn: Date | string | null | undefined): string | null {
  return recordadoPor && recordadoEn ? `${recordadoPor.nombre} espera su firma (aviso del ${formatearFechaHora(recordadoEn)})` : null;
}

export function EsperaTurnoFirma({ esperaA, solicitudId }: { esperaA: Anterior[]; solicitudId: string }) {
  return (
    <span className="inline-flex flex-none flex-wrap items-center gap-1.5 rounded-md border border-stone-200 px-3 py-1.5 text-xs text-stone-500">
      <Lock className="h-3.5 w-3.5 text-stone-400" aria-hidden />
      {esperaA.length === 0 ? (
        "Esperando turno"
      ) : (
        <>
          Antes firma:
          <span className="font-medium text-stone-700">{esperaA.map((p) => p.nombre).join(", ")}</span>
          {esperaA.some((p) => p.recordadoEn) && (
            <span className="text-[10px] text-stone-400">
              · avisado el {formatearFechaHora(esperaA.map((p) => p.recordadoEn).filter(Boolean).sort().at(-1)!)}
            </span>
          )}
          <BotonAvisarFirmantes solicitudId={solicitudId} />
        </>
      )}
    </span>
  );
}
