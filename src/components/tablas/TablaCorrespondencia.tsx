"use client";

import Link from "next/link";
import { FileText, ArrowRight, ArrowLeft, MailCheck } from "lucide-react";
import { useAnchosColumna } from "@/lib/usar-anchos-columna";
import { ManijaRedimension } from "@/components/ManijaRedimension";
import { ProgresoCorrespondencia } from "@/components/ProgresoCorrespondencia";

const ENCABEZADOS = ["#", "Tipo", "Radicado", "Fecha", "Tercero / dependencia", "Asunto", "Progreso", "Vence", "Docs."];
const ANCHOS_DEFECTO = [34, 86, 190, 96, 160, 188, 138, 104, 52];

const ETIQUETA_TIPO: Record<string, { texto: string; clase: string }> = {
  RECIBIDA: { texto: "Recibida", clase: "bg-sky-50 text-sky-700" },
  ENVIADA: { texto: "Enviada", clase: "bg-emerald-50 text-emerald-700" },
  INTERNA: { texto: "Memorando", clase: "bg-violet-50 text-violet-700" },
};

export type FilaCorrespondencia = {
  id: string;
  numero: number;
  tipo: string;
  radicado: string;
  fecha: string;
  tercero: string | null;
  asunto: string;
  estado: string;
  vencimiento: { texto: string; clase: string } | null;
  docs: number;
  documentosCoincidentes?: string[];
  /** Vínculo entrada↔salida: `entrante` = el radicado enlazado es la recibida a la que responde;
   * si no, es el oficio de salida que la responde. `despachada` = ese oficio ya se envió. */
  relacion?: { id: string; radicado: string; entrante: boolean; despachada: boolean } | null;
};

/** Tabla de correspondencia (recibida/enviada/interna) — columnas redimensionables (ancho recordado por navegador). */
export function TablaCorrespondencia({ filas, sinResultadosTexto }: { filas: FilaCorrespondencia[]; sinResultadosTexto: string }) {
  const { anchos, cambiarAncho, restablecer } = useAnchosColumna("correspondencia-v5", ANCHOS_DEFECTO);

  return (
    <table className="w-full table-fixed text-sm">
      <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
        <tr>
          {ENCABEZADOS.map((titulo, i) => (
            <th key={titulo} className="relative px-2.5 py-2 font-medium" style={{ width: anchos[i] }}>
              <span className="block truncate" title={titulo}>{titulo}</span>
              <ManijaRedimension anchoActual={anchos[i]} onCambiar={(a) => cambiarAncho(i, a)} onRestablecer={() => restablecer(i)} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-stone-100">
        {filas.length === 0 ? (
          <tr>
            <td colSpan={ENCABEZADOS.length} className="px-2.5 py-10 text-center text-stone-400">
              {sinResultadosTexto}
            </td>
          </tr>
        ) : (
          filas.map((f) => {
            const tipo = ETIQUETA_TIPO[f.tipo] ?? { texto: f.tipo, clase: "bg-stone-100 text-stone-600" };
            return (
              <tr key={f.id} className="hover:bg-stone-50">
                <td className="truncate px-2.5 py-2 text-stone-400">{f.numero}</td>
                <td className="truncate px-2.5 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tipo.clase}`}>{tipo.texto}</span>
                </td>
                <td className="px-2.5 py-2">
                  <Link href={`/correspondencia/${f.id}`} className="block truncate font-medium text-cdmb-700 hover:underline" title={f.radicado}>
                    {f.radicado}
                  </Link>
                  {f.relacion && (
                    <Link
                      href={`/correspondencia/${f.relacion.id}`}
                      className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-stone-400 hover:text-stone-600"
                      title={
                        f.relacion.entrante
                          ? `Responde a ${f.relacion.radicado}`
                          : f.relacion.despachada
                            ? `Respondida por ${f.relacion.radicado} (despachada)`
                            : `Respondida por ${f.relacion.radicado} (sin despachar)`
                      }
                    >
                      {f.relacion.entrante ? (
                        <ArrowLeft className="h-3 w-3 flex-none" aria-hidden />
                      ) : f.relacion.despachada ? (
                        <MailCheck className="h-3 w-3 flex-none text-emerald-500" aria-hidden />
                      ) : (
                        <ArrowRight className="h-3 w-3 flex-none" aria-hidden />
                      )}
                      {f.relacion.radicado}
                    </Link>
                  )}
                </td>
                <td className="truncate px-2.5 py-2 text-stone-500">{f.fecha}</td>
                <td className="truncate px-2.5 py-2 text-stone-700" title={f.tercero ?? undefined}>{f.tercero ?? "—"}</td>
                <td className="px-2.5 py-2 text-stone-600">
                  <p className="truncate" title={f.asunto}>{f.asunto}</p>
                  {f.documentosCoincidentes && f.documentosCoincidentes.length > 0 && (
                    <p
                      className="mt-0.5 flex items-center gap-1 truncate text-xs text-cdmb-600"
                      title={f.documentosCoincidentes.join(", ")}
                    >
                      <FileText className="h-3 w-3 flex-none" aria-hidden />
                      Coincide: {f.documentosCoincidentes.join(", ")}
                    </p>
                  )}
                </td>
                <td className="px-2.5 py-2">
                  <ProgresoCorrespondencia estado={f.estado} tipo={f.tipo} />
                </td>
                <td className="truncate px-2.5 py-2">
                  {f.vencimiento ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.vencimiento.clase}`}>{f.vencimiento.texto}</span>
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </td>
                <td className="truncate px-2.5 py-2 text-center text-stone-500">{f.docs || "—"}</td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
