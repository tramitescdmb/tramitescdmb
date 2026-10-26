import { Check } from "lucide-react";
import { ETAPAS_CONCEPTO, ETIQUETA_ACCION_REVISION, type EtapaConcepto } from "@/lib/revision-concepto";
import { formatearFechaHora } from "@/lib/fecha";
import type { AccionRevisionConcepto } from "@prisma/client";

const ORDEN: Record<EtapaConcepto, number> = { REGISTRADO: 0, DEVUELTO: 0, EN_REVISION: 1, EN_FIRMA: 2, FIRMADO: 3 };

export function LineaEstadoConcepto({
  etapa,
  revisiones,
}: {
  etapa: EtapaConcepto;
  revisiones: { id: string; accion: AccionRevisionConcepto; comentario: string | null; createdAt: Date; usuario: { nombre: string } }[];
}) {
  const actual = ORDEN[etapa];
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft print:hidden">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
        {ETAPAS_CONCEPTO.map((e, i) => {
          const hecho = i < actual || (etapa === "FIRMADO" && i === actual);
          const enCurso = i === actual && etapa !== "FIRMADO";
          return (
            <li key={e.clave} className="flex items-center gap-1">
              <span
                className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 font-medium ${
                  enCurso ? (etapa === "DEVUELTO" ? "bg-amber-100 text-amber-900" : "bg-cdmb-600 text-white") : hecho ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-400"
                }`}
              >
                {hecho && <Check className="h-3 w-3" aria-hidden />}
                {enCurso && etapa === "DEVUELTO" ? "Devuelto para corrección" : e.etiqueta}
              </span>
              {i < ETAPAS_CONCEPTO.length - 1 && <span className="text-stone-300">→</span>}
            </li>
          );
        })}
      </ol>
      {revisiones.length > 0 && (
        <details className="mt-3" open={etapa === "DEVUELTO"}>
          <summary className="cursor-pointer text-xs font-medium text-stone-600">Historial de revisión ({revisiones.length})</summary>
          <ol className="mt-2 space-y-1.5 border-l border-stone-200 pl-3">
            {revisiones.map((r) => (
              <li key={r.id} className="text-xs text-stone-600">
                <span className="font-medium text-stone-800">{ETIQUETA_ACCION_REVISION[r.accion]}</span> · {r.usuario.nombre} · {formatearFechaHora(r.createdAt)}
                {r.comentario && <span className="mt-0.5 block whitespace-pre-line rounded bg-stone-50 px-2 py-1 text-stone-700">{r.comentario}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
