"use client";

import Link from "next/link";
import { useAnchosColumna } from "@/lib/usar-anchos-columna";
import { ManijaRedimension } from "@/components/ManijaRedimension";
import { contarVinculadas, type EntidadNit } from "@/lib/sinca-nit";

const ENCABEZADOS = [
  { texto: "#" },
  { texto: "NIT / Cédula" },
  { texto: "Nombre / Razón social" },
  { texto: "Tipo" },
  { texto: "Régimen" },
  { texto: "Municipio" },
  { texto: "S", title: "Solicitudes: total de solicitudes a las que ha quedado vinculado este tercero" },
  { texto: "V", title: "Vinculadas: cuántas de esas solicitudes tienen el detalle completo disponible en esta plataforma" },
];
const ANCHOS_DEFECTO = [36, 130, 300, 110, 150, 120, 48, 48];

export type FilaNit = EntidadNit & { numero: number };

/** Tabla del registro de terceros de SINCA 1.0, una fila por NIT/cédula distinto — columnas redimensionables (ancho recordado por navegador), igual patrón que Solicitudes y VITAL, filas compactas para que quepan más sin desplazar tanto. */
export function TablaNits({ filas, sinResultadosTexto }: { filas: FilaNit[]; sinResultadosTexto: string }) {
  const { anchos, cambiarAncho, restablecer } = useAnchosColumna("sinca-nits", ANCHOS_DEFECTO);

  return (
    <table className="w-full table-fixed text-sm">
      <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
        <tr>
          {ENCABEZADOS.map((h, i) => (
            <th key={h.texto} className="relative px-2.5 py-1.5 font-medium" style={{ width: anchos[i] }} title={h.title}>
              {h.texto}
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
            const vinculadas = contarVinculadas(f);
            return (
              <tr key={f.clave} className="hover:bg-stone-50">
                <td className="truncate px-2.5 py-1 text-stone-400">{f.numero}</td>
                <td className="truncate px-2.5 py-1">
                  {f.numeroNit != null ? (
                    <Link href={`/historico/nits/${f.numeroNit}`} className="font-medium text-cdmb-700 hover:underline">
                      {f.identificacion}
                    </Link>
                  ) : (
                    <span className="font-medium text-stone-600">{f.identificacion}</span>
                  )}
                </td>
                <td className="truncate px-2.5 py-1 text-stone-700" title={f.nombre}>
                  {f.nombre}
                </td>
                <td className="truncate px-2.5 py-1 text-stone-600">{f.tipoLabel ?? "—"}</td>
                <td className="truncate px-2.5 py-1 text-stone-600" title={f.regimen ?? undefined}>
                  {f.regimen ?? "—"}
                </td>
                <td className="truncate px-2.5 py-1 text-stone-600">{f.municipio ?? "—"}</td>
                <td className="truncate px-2.5 py-1 text-stone-600">{f.vinculaciones.length}</td>
                <td
                  className={`truncate px-2.5 py-1 ${vinculadas > 0 ? "font-semibold text-emerald-700" : "text-stone-300"}`}
                  title={vinculadas > 0 ? "Solicitudes con detalle disponible en esta plataforma" : "Ninguna de sus solicitudes tiene detalle disponible en esta plataforma"}
                >
                  {vinculadas}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
