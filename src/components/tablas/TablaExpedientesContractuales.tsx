"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Hash, Landmark, FileSignature, FileText, ShieldCheck, Building2, User, UserCog, Files, Flag, CalendarDays, CalendarCheck } from "lucide-react";
import { useAnchosColumna } from "@/lib/usar-anchos-columna";
import { ManijaRedimension } from "@/components/ManijaRedimension";

const COLUMNAS: { titulo: string; icono: ReactNode; ancho: number }[] = [
  { titulo: "Código de proceso", icono: <Hash className="h-3.5 w-3.5" aria-hidden />, ancho: 150 },
  { titulo: "N.º proceso SECOP", icono: <Landmark className="h-3.5 w-3.5" aria-hidden />, ancho: 130 },
  { titulo: "N.º contrato", icono: <FileSignature className="h-3.5 w-3.5" aria-hidden />, ancho: 110 },
  { titulo: "Objeto", icono: <FileText className="h-3.5 w-3.5" aria-hidden />, ancho: 360 },
  { titulo: "Modalidad", icono: <ShieldCheck className="h-3.5 w-3.5" aria-hidden />, ancho: 140 },
  { titulo: "Dependencia", icono: <Building2 className="h-3.5 w-3.5" aria-hidden />, ancho: 190 },
  { titulo: "Contratista", icono: <User className="h-3.5 w-3.5" aria-hidden />, ancho: 170 },
  { titulo: "Supervisor", icono: <UserCog className="h-3.5 w-3.5" aria-hidden />, ancho: 170 },
  { titulo: "Documentos", icono: <Files className="h-3.5 w-3.5" aria-hidden />, ancho: 110 },
  { titulo: "Etapa", icono: <Flag className="h-3.5 w-3.5" aria-hidden />, ancho: 140 },
  { titulo: "Suscripción", icono: <CalendarDays className="h-3.5 w-3.5" aria-hidden />, ancho: 110 },
  { titulo: "Terminación", icono: <CalendarCheck className="h-3.5 w-3.5" aria-hidden />, ancho: 110 },
];
const ANCHOS_DEFECTO = COLUMNAS.map((c) => c.ancho);

export type FilaExpedienteContractual = {
  id: string;
  numero: string;
  codigoProceso: string | null;
  numeroProcesoSecop: string | null;
  numeroContrato: string | null;
  objeto: string;
  modalidad: string;
  dependencia: string;
  contratista: string | null;
  supervisor: string | null;
  supervisorSinUsuario: boolean;
  documentos: number;
  etapa: string;
  tonoEtapa: "pendiente" | "cerrado" | "activa";
  firma: string | null;
  terminacion: string | null;
  creado: string;
};

const CLASE_ETAPA: Record<FilaExpedienteContractual["tonoEtapa"], string> = {
  pendiente: "bg-amber-50 text-amber-700",
  cerrado: "bg-stone-100 text-stone-600",
  activa: "bg-cdmb-50 text-cdmb-700",
};

export function TablaExpedientesContractuales({ filas }: { filas: FilaExpedienteContractual[] }) {
  const { anchos, cambiarAncho, restablecer } = useAnchosColumna("expedientes-contractuales-v2", ANCHOS_DEFECTO);
  const anchoTotal = anchos.reduce((a, b) => a + b, 0);

  return (
    <table className="table-fixed text-sm" style={{ width: anchoTotal, minWidth: "100%" }}>
      <thead className="bg-stone-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
        <tr>
          {COLUMNAS.map((c, i) => (
            <th key={c.titulo} className="relative px-3 py-2" style={{ width: anchos[i] }}>
              <span className="flex items-center gap-1.5" title={c.titulo}>
                <span className="flex-none text-cdmb-600">{c.icono}</span>
                <span className="truncate">{c.titulo}</span>
              </span>
              <ManijaRedimension anchoActual={anchos[i]} onCambiar={(a) => cambiarAncho(i, a)} onRestablecer={() => restablecer(i)} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-stone-100">
        {filas.map((e) => (
          <tr key={e.id} className="align-top hover:bg-stone-50/60">
            <td className="break-all px-3 py-2 font-mono text-xs">
              <Link href={`/contratacion/expedientes/${e.id}`} className="text-cdmb-700 hover:underline">
                {e.codigoProceso ?? e.numero}
              </Link>
              {e.codigoProceso && <span className="block text-[10px] text-stone-400">{e.numero}</span>}
            </td>
            <td className="break-all px-3 py-2 font-mono text-xs text-stone-500">{e.numeroProcesoSecop ?? "—"}</td>
            <td className="break-all px-3 py-2 font-mono text-xs text-stone-500">{e.numeroContrato ?? "—"}</td>
            <td className="px-3 py-2">
              <p className="line-clamp-5 text-justify text-xs leading-snug text-stone-700 hyphens-auto" lang="es" title={e.objeto}>
                {e.objeto}
              </p>
            </td>
            <td className="px-3 py-2 text-xs text-stone-500">{e.modalidad}</td>
            <td className="px-3 py-2 text-xs text-stone-500">{e.dependencia}</td>
            <td className="px-3 py-2 text-xs text-stone-500">{e.contratista ?? "—"}</td>
            <td className="px-3 py-2 text-xs text-stone-500">
              {e.supervisor ?? "—"}
              {e.supervisorSinUsuario && (
                <span className="mt-0.5 block text-[10px] text-amber-700" title="Reportado por SECOP II; aún no existe un usuario con su documento">
                  SECOP II · sin usuario
                </span>
              )}
            </td>
            <td className="px-3 py-2 text-xs text-stone-500">{e.documentos}</td>
            <td className="px-3 py-2 text-xs">
              <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${CLASE_ETAPA[e.tonoEtapa]}`}>{e.etapa}</span>
            </td>
            <td className="px-3 py-2 text-xs text-stone-600">{e.firma ?? "Sin suscribir"}</td>
            <td className="px-3 py-2 text-xs text-stone-600">{e.terminacion ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
