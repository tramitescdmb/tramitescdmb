"use client";

import Link from "next/link";
import { useAnchosColumna } from "@/lib/usar-anchos-columna";
import { ManijaRedimension } from "@/components/ManijaRedimension";

const ENCABEZADOS = ["#", "NIT / Cédula", "Nombre / Razón social", "Tipo", "Régimen", "Municipio", "Solicitud vinculada"];
const ANCHOS_DEFECTO = [36, 130, 280, 120, 160, 120, 140];

export type FilaNit = {
  key: string;
  numero: number;
  identificacion: string;
  nombre: string;
  tipo: string | null;
  regimen: string | null;
  municipio: string | null;
  nroSolicitud: number | null;
  /** Si el detalle de esta solicitud existe en el espejo local (solo resoluciones de fondo) — si no, se muestra el número sin enlace. */
  tieneDetalle: boolean;
  fechaDesde: string;
};

/** Tabla del registro de NIT/cédulas de SINCA 1.0. Cada fila es una vinculación con una solicitud: un mismo NIT puede repetirse si aparece en más de una. */
export function TablaSincaNits({ filas, sinResultadosTexto }: { filas: FilaNit[]; sinResultadosTexto: string }) {
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
            <tr key={f.key} className="hover:bg-stone-50">
              <td className="truncate px-2.5 py-2 text-stone-400">{f.numero}</td>
              <td className="truncate px-2.5 py-2 font-medium text-stone-800">{f.identificacion}</td>
              <td className="truncate px-2.5 py-2 text-stone-700" title={f.nombre}>
                {f.nombre}
              </td>
              <td className="truncate px-2.5 py-2 text-stone-600">{f.tipo ?? "—"}</td>
              <td className="truncate px-2.5 py-2 text-stone-600" title={f.regimen ?? undefined}>
                {f.regimen ?? "—"}
              </td>
              <td className="truncate px-2.5 py-2 text-stone-600">{f.municipio ?? "—"}</td>
              <td className="truncate px-2.5 py-2">
                {f.nroSolicitud ? (
                  f.tieneDetalle ? (
                    <Link href={`/historico/solicitudes/${f.nroSolicitud}`} className="font-medium text-cdmb-700 hover:underline">
                      {f.nroSolicitud}
                    </Link>
                  ) : (
                    <span className="font-medium text-stone-600" title="Esta solicitud no tiene resolución de fondo en el histórico.">
                      {f.nroSolicitud}
                    </span>
                  )
                ) : (
                  "—"
                )}
                {f.fechaDesde && <span className="block truncate text-xs text-stone-400">{f.fechaDesde}</span>}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
