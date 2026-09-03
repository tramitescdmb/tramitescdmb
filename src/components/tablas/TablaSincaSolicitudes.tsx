"use client";

import Link from "next/link";
import { useAnchosColumna } from "@/lib/usar-anchos-columna";
import { ManijaRedimension } from "@/components/ManijaRedimension";

const ENCABEZADOS = ["#", "Solicitud", "Resolución", "Fecha", "Tipo", "Municipio", "Estado"];
const ANCHOS_DEFECTO = [36, 110, 100, 150, 150, 110, 110];

export type FilaSinca = {
  nroSolicitud: number;
  numero: number;
  expediente: string | null;
  numeroResolucion: string | null;
  fecha: string;
  tipoNombre: string | null;
  tipoCodigo: string | null;
  municipio: string | null;
  estado: string | null;
};

/** Tabla de solicitudes de SINCA 1.0 con columnas redimensionables (ancho recordado por navegador). */
export function TablaSincaSolicitudes({ filas, sinResultadosTexto }: { filas: FilaSinca[]; sinResultadosTexto: string }) {
  const { anchos, cambiarAncho, restablecer } = useAnchosColumna("sinca-solicitudes", ANCHOS_DEFECTO);

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
            <tr key={f.nroSolicitud} className="hover:bg-stone-50">
              <td className="truncate px-2.5 py-2 text-stone-400">{f.numero}</td>
              <td className="truncate px-2.5 py-2">
                <Link href={`/historico/solicitudes/${f.nroSolicitud}`} className="font-medium text-cdmb-700 hover:underline">
                  {f.nroSolicitud}
                </Link>
                {f.expediente && <span className="block truncate text-xs text-stone-400">Exp. {f.expediente}</span>}
              </td>
              <td className="truncate px-2.5 py-2 text-stone-700">{f.numeroResolucion ?? "—"}</td>
              <td className="truncate px-2.5 py-2 text-stone-600">{f.fecha}</td>
              <td className="truncate px-2.5 py-2 text-stone-600" title={f.tipoNombre ?? undefined}>
                {f.tipoNombre ?? "—"}
                {f.tipoCodigo && <span className="ml-1 text-xs text-stone-400">({f.tipoCodigo})</span>}
              </td>
              <td className="truncate px-2.5 py-2 text-stone-600">{f.municipio ?? "—"}</td>
              <td className="truncate px-2.5 py-2">
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{f.estado ?? "—"}</span>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
