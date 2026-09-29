import type { ReactNode } from "react";
import { CheckCircle2, Clock, Lock, XCircle, Eye } from "lucide-react";
import { formatearFechaHora } from "@/lib/fecha";
import { ETIQUETA_ESTADO_FILA, type EstadoFilaFirma, type FilaFirmante } from "@/lib/panel-firmas";

const ESTILO_ESTADO: Record<EstadoFilaFirma, { clase: string; Icono: typeof CheckCircle2 }> = {
  FIRMADO: { clase: "bg-emerald-50 text-emerald-700", Icono: CheckCircle2 },
  VISTO_BUENO: { clase: "bg-emerald-50 text-emerald-700", Icono: CheckCircle2 },
  TURNO: { clase: "bg-amber-50 text-amber-800", Icono: Clock },
  EN_ESPERA: { clase: "bg-stone-100 text-stone-500", Icono: Lock },
  RECHAZADO: { clase: "bg-red-50 text-red-700", Icono: XCircle },
  LECTURA: { clase: "bg-stone-100 text-stone-500", Icono: Eye },
};

export function PanelFirmas({ filas, acciones, vacio }: { filas: FilaFirmante[]; acciones?: ReactNode; vacio?: string }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">
        Orden de firma por cargo: Dirección General → Secretaría General → Subdirección o Jefatura de Oficina → Funcionario o
        Supervisor → Contratista. Los cargos del mismo nivel firman en cualquier orden entre sí; un contratista no puede ser
        firmante principal ni solicitar firmas.
      </p>
      {filas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50/60 p-3 text-center text-xs text-stone-400">
          {vacio ?? "Todavía no hay firmas ni firmantes designados."}
        </p>
      ) : (
        <ol className="divide-y divide-stone-100 rounded-lg border border-stone-200">
          {filas.map((f, i) => {
            const { clase, Icono } = ESTILO_ESTADO[f.estado];
            return (
              <li key={f.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2">
                <span className="mt-0.5 w-5 flex-none text-right font-mono text-[11px] text-stone-400">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-800">
                    {f.nombre}
                    <span className="ml-1.5 rounded-full bg-cdmb-50 px-1.5 py-0.5 text-[10px] font-medium text-cdmb-700">{f.calidad}</span>
                  </p>
                  <p className="text-xs text-stone-500">{f.cargo}</p>
                  {f.comentario && <p className="mt-0.5 text-xs text-red-700">Motivo: {f.comentario}</p>}
                </div>
                <span className={`inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${clase}`}>
                  <Icono className="h-3 w-3" aria-hidden />
                  {ETIQUETA_ESTADO_FILA[f.estado]}
                  {f.fecha && <span className="font-normal opacity-80"> · {formatearFechaHora(f.fecha)}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}
