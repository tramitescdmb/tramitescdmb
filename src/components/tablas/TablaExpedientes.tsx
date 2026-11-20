"use client";

import Link from "next/link";
import { CheckCircle2, Lock, UserCheck, UserPlus } from "lucide-react";
import { useAnchosColumna } from "@/lib/usar-anchos-columna";
import { ManijaRedimension } from "@/components/ManijaRedimension";
import { ProgresoExpediente } from "@/components/ProgresoExpediente";
import { EstadoBadge } from "@/components/EstadoBadge";

const ENCABEZADOS = ["#", "Número", "Trámite", "Solicitante", "Municipio", "Avance", "Estado", "Asignado a", "Último movimiento"];
const ANCHOS_DEFECTO = [36, 130, 170, 150, 100, 150, 120, 160, 130];

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
  finalizado?: boolean;
  archivado?: boolean;
  fechaUltimoMovimiento: string;
  /** Personas y cargos asignados al expediente. */
  asignados?: string[];
};

export function TablaExpedientes({ filas, puedeAsignar = false }: { filas: FilaExpediente[]; puedeAsignar?: boolean }) {
  const { anchos, cambiarAncho, restablecer } = useAnchosColumna("expedientes-v2", ANCHOS_DEFECTO);

  return (
    <table className="tabla-listado w-full table-fixed text-sm">
      <thead className="bg-stone-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
        <tr>
          {ENCABEZADOS.map((titulo, i) => (
            <th key={titulo} className="relative px-2.5 py-2" style={{ width: anchos[i] }}>
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
              <ProgresoExpediente pasoActualNumero={f.pasoActualNumero} totalPasos={f.totalPasos} pasosAvance={f.pasosAvance} estado={f.estado} finalizado={f.finalizado} />
            </td>
            <td className="px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-1">
                <EstadoBadge estado={f.estado} />
                {f.finalizado && !f.archivado && (
                  <span
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white"
                    title="Se completó el último paso del procedimiento"
                  >
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    Finalizado
                  </span>
                )}
                {f.archivado && (
                  <span
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm bg-stone-800 px-2 py-0.5 text-xs font-medium text-white"
                    title="Expediente digital cerrado y archivado"
                  >
                    <Lock className="h-3 w-3" aria-hidden />
                    Cerrado
                  </span>
                )}
              </div>
            </td>
            <td className="px-2.5 py-2 text-xs">
              {f.asignados && f.asignados.length > 0 ? (
                <span className="line-clamp-2 text-stone-700" title={f.asignados.join(", ")}>
                  {f.asignados.join(", ")}
                </span>
              ) : (
                <span className="text-stone-400">Sin asignar</span>
              )}
              {puedeAsignar && !f.finalizado && !f.archivado && (
                <Link
                  prefetch={false}
                  href={`/expedientes/${f.id}?asignar=1`}
                  className="mt-0.5 inline-flex items-center gap-1 font-medium text-acento-600 hover:underline"
                >
                  {f.asignados && f.asignados.length > 0 ? <UserCheck className="h-3 w-3" aria-hidden /> : <UserPlus className="h-3 w-3" aria-hidden />}
                  {f.asignados && f.asignados.length > 0 ? "Reasignar" : "Asignar"}
                </Link>
              )}
            </td>
            <td className="truncate px-2.5 py-2 text-stone-500">{f.fechaUltimoMovimiento}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
