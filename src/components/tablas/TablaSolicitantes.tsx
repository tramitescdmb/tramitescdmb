"use client";

import Link from "next/link";
import { useAnchosColumna } from "@/lib/usar-anchos-columna";
import { ManijaRedimension } from "@/components/ManijaRedimension";

const ENCABEZADOS = ["#", "Identificación", "Nombre / razón social", "Régimen tributario", "Municipio", "Expedientes"];
const ANCHOS_DEFECTO = [36, 130, 240, 160, 120, 100];

export type FilaSolicitante = {
  id: string;
  numero: number;
  identificacion: string;
  tipoPersonaTexto: string;
  nombreCompleto: string;
  granContribuyente: boolean;
  regimenTributario: string;
  municipio: string;
  totalExpedientes: number;
};

/** Tabla de solicitantes con columnas redimensionables (ancho recordado por navegador). */
export function TablaSolicitantes({ filas, sinResultadosTexto }: { filas: FilaSolicitante[]; sinResultadosTexto: string }) {
  const { anchos, cambiarAncho, restablecer } = useAnchosColumna("solicitantes", ANCHOS_DEFECTO);

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
            <tr key={f.id} className="transition-colors hover:bg-stone-50">
              <td className="truncate px-2.5 py-2 text-stone-400">{f.numero}</td>
              <td className="truncate px-2.5 py-2">
                <Link href={`/solicitantes/${f.id}`} className="font-medium text-cdmb-700 hover:underline">
                  {f.identificacion}
                </Link>
                <span className="block truncate text-xs text-stone-400">{f.tipoPersonaTexto}</span>
              </td>
              <td className="truncate px-2.5 py-2 text-stone-700" title={f.nombreCompleto}>
                {f.nombreCompleto}
                {f.granContribuyente && (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Gran contribuyente
                  </span>
                )}
              </td>
              <td className="truncate px-2.5 py-2 text-stone-500">{f.regimenTributario}</td>
              <td className="truncate px-2.5 py-2 text-stone-500">{f.municipio}</td>
              <td className="truncate px-2.5 py-2 text-stone-500">{f.totalExpedientes}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
