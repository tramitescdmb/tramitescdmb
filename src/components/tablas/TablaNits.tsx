"use client";

import Link from "next/link";
import { useAnchosColumna } from "@/lib/usar-anchos-columna";
import { ManijaRedimension } from "@/components/ManijaRedimension";
import type { EntidadNit } from "@/lib/sinca-nit";

const ENCABEZADOS = ["#", "NIT / Cédula", "Nombre / Razón social", "Tipo", "Régimen", "Municipio", "Solicitudes"];
const ANCHOS_DEFECTO = [36, 130, 300, 130, 170, 130, 100];

export type FilaNit = EntidadNit & { numero: number };

/** Tabla del registro de terceros de SINCA 1.0, una fila por NIT/cédula distinto — columnas redimensionables (ancho recordado por navegador), igual patrón que Solicitudes y VITAL. */
export function TablaNits({ filas, sinResultadosTexto }: { filas: FilaNit[]; sinResultadosTexto: string }) {
  const { anchos, cambiarAncho, restablecer } = useAnchosColumna("sinca-nits", ANCHOS_DEFECTO);

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
            <tr key={f.clave} className="hover:bg-stone-50">
              <td className="truncate px-2.5 py-2 text-stone-400">{f.numero}</td>
              <td className="truncate px-2.5 py-2">
                {f.numeroNit != null ? (
                  <Link href={`/historico/nits/${f.numeroNit}`} className="font-medium text-cdmb-700 hover:underline">
                    {f.identificacion}
                  </Link>
                ) : (
                  <span className="font-medium text-stone-600">{f.identificacion}</span>
                )}
              </td>
              <td className="truncate px-2.5 py-2 text-stone-700" title={f.nombre}>
                {f.nombre}
              </td>
              <td className="truncate px-2.5 py-2 text-stone-600">{f.tipoLabel ?? "—"}</td>
              <td className="truncate px-2.5 py-2 text-stone-600" title={f.regimen ?? undefined}>
                {f.regimen ?? "—"}
              </td>
              <td className="truncate px-2.5 py-2 text-stone-600">{f.municipio ?? "—"}</td>
              <td className="truncate px-2.5 py-2 text-stone-600">{f.vinculaciones.length}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
