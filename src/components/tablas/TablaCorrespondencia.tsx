"use client";

import Link from "next/link";
import { useAnchosColumna } from "@/lib/usar-anchos-columna";
import { ManijaRedimension } from "@/components/ManijaRedimension";

const ENCABEZADOS = ["#", "Tipo", "Radicado", "Fecha", "Tercero / dependencia", "Asunto", "Estado", "Docs."];
const ANCHOS_DEFECTO = [36, 90, 150, 110, 190, 250, 110, 56];

const ETIQUETA_ESTADO: Record<string, string> = {
  RADICADA: "Radicada",
  EN_REPARTO: "En reparto",
  ASIGNADA: "Asignada",
  EN_TRAMITE: "En trámite",
  RESPONDIDA: "Respondida",
  ARCHIVADA: "Archivada",
  ANULADA: "Anulada",
};

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
  docs: number;
};

/** Tabla de correspondencia (recibida/enviada/interna) — columnas redimensionables (ancho recordado por navegador). */
export function TablaCorrespondencia({ filas, sinResultadosTexto }: { filas: FilaCorrespondencia[]; sinResultadosTexto: string }) {
  const { anchos, cambiarAncho, restablecer } = useAnchosColumna("correspondencia-v2", ANCHOS_DEFECTO);

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
                <td className="truncate px-2.5 py-2">
                  <Link href={`/correspondencia/${f.id}`} className="font-medium text-cdmb-700 hover:underline" title={f.radicado}>
                    {f.radicado}
                  </Link>
                </td>
                <td className="truncate px-2.5 py-2 text-stone-500">{f.fecha}</td>
                <td className="truncate px-2.5 py-2 text-stone-700" title={f.tercero ?? undefined}>{f.tercero ?? "—"}</td>
                <td className="truncate px-2.5 py-2 text-stone-600" title={f.asunto}>{f.asunto}</td>
                <td className="truncate px-2.5 py-2">
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{ETIQUETA_ESTADO[f.estado] ?? f.estado}</span>
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
