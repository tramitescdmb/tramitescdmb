"use client";

import Link from "next/link";
import { useAnchosColumna } from "@/lib/usar-anchos-columna";
import { ManijaRedimension } from "@/components/ManijaRedimension";

const ENCABEZADOS = ["#", "ID VITAL", "Trámite", "Solicitante", "Identificación", "Radicación", "Actividad", "Docs."];
const ANCHOS_DEFECTO = [36, 170, 170, 130, 90, 150, 120, 56];

export type FilaVital = {
  id: string;
  numero: number;
  idVital: string;
  tramite: string;
  solicitante: string | null;
  identificacion: string | null;
  radicacion: string;
  actividad: string | null;
  docs: number;
};

/** Tabla de solicitudes de VITAL con columnas redimensionables (ancho recordado por navegador). */
export function TablaVital({ filas, sinResultadosTexto }: { filas: FilaVital[]; sinResultadosTexto: string }) {
  const { anchos, cambiarAncho, restablecer } = useAnchosColumna("vital-solicitudes", ANCHOS_DEFECTO);

  return (
    <table className="w-full table-fixed text-sm">
      <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
        <tr>
          {ENCABEZADOS.map((titulo, i) => (
            <th key={titulo} className="relative px-2.5 py-2 font-medium" style={{ width: anchos[i] }}>
              {titulo}
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
          filas.map((f) => (
            <tr key={f.id} className="hover:bg-stone-50">
              <td className="truncate px-2.5 py-2 text-stone-400">{f.numero}</td>
              <td className="truncate px-2.5 py-2">
                <Link href={`/vital/${f.id}`} className="text-xs font-medium text-cdmb-700 hover:underline" title={f.idVital}>
                  {f.idVital}
                </Link>
              </td>
              <td className="truncate px-2.5 py-2 text-stone-600" title={f.tramite}>
                {f.tramite}
              </td>
              <td className="truncate px-2.5 py-2 text-stone-700" title={f.solicitante ?? undefined}>
                {f.solicitante ?? "—"}
              </td>
              <td className="truncate px-2.5 py-2 text-stone-500">{f.identificacion ?? "—"}</td>
              <td className="truncate px-2.5 py-2 text-stone-500">{f.radicacion}</td>
              <td className="truncate px-2.5 py-2 text-stone-600" title={f.actividad ?? undefined}>
                {f.actividad ?? "—"}
              </td>
              <td className="truncate px-2.5 py-2 text-center text-stone-500">{f.docs || "—"}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
