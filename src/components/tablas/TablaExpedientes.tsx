"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useAnchosColumna } from "@/lib/usar-anchos-columna";
import { ManijaRedimension } from "@/components/ManijaRedimension";
import { ProgresoExpediente } from "@/components/ProgresoExpediente";
import { EstadoBadge } from "@/components/EstadoBadge";

const ENCABEZADOS = ["#", "Número", "Trámite", "Solicitante", "Municipio", "Avance", "Estado", "Último movimiento"];
const ANCHOS_DEFECTO = [36, 130, 170, 150, 100, 150, 120, 150];

export type FilaExpediente = {
  id: string;
  numero: number;
  numeroExpediente: string;
  tramiteNombre: string;
  solicitanteNombre: string;
  solicitanteIdentificacion: string;
  municipio: string;
  pasoActualNumero: number;
  totalPasos: number;
  pasosAvance?: number;
  estado: string;
  archivado?: boolean;
  fechaUltimoMovimiento: string;
};

export function TablaExpedientes({ filas }: { filas: FilaExpediente[] }) {
  const { anchos, cambiarAncho, restablecer } = useAnchosColumna("expedientes", ANCHOS_DEFECTO);

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
        {filas.map((f) => (
          <tr key={f.id} className="hover:bg-stone-50">
            <td className="truncate px-2.5 py-2 text-stone-400">{f.numero}</td>
            <td className="truncate px-2.5 py-2">
              <Link prefetch={false} href={`/expedientes/${f.id}`} className="font-medium text-cdmb-700 hover:underline">
                {f.numeroExpediente}
              </Link>
            </td>
            <td className="truncate px-2.5 py-2 text-stone-700" title={f.tramiteNombre}>
              {f.tramiteNombre}
            </td>
            <td className="truncate px-2.5 py-2 text-stone-700" title={f.solicitanteNombre}>
              {f.solicitanteNombre}
              <span className="block truncate text-xs text-stone-400">{f.solicitanteIdentificacion}</span>
            </td>
            <td className="truncate px-2.5 py-2 text-stone-500">{f.municipio}</td>
            <td className="px-2.5 py-2">
              <ProgresoExpediente pasoActualNumero={f.pasoActualNumero} totalPasos={f.totalPasos} pasosAvance={f.pasosAvance} estado={f.estado} />
            </td>
            <td className="px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-1">
                <EstadoBadge estado={f.estado} />
                {f.archivado && (
                  <span
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-stone-800 px-2 py-0.5 text-xs font-medium text-white"
                    title="Cerrado y archivado en el SGDEA"
                  >
                    <Lock className="h-3 w-3" aria-hidden />
                    Cerrado
                  </span>
                )}
              </div>
            </td>
            <td className="truncate px-2.5 py-2 text-stone-500">{f.fechaUltimoMovimiento}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
