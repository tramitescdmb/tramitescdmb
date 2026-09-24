import Link from "next/link";
import { FolderOpen, Lock, Files, User } from "lucide-react";
import { ETIQUETA_ETAPA, ETIQUETA_MODALIDAD } from "@/lib/contratacion";
import type { EtapaContratacion, ModalidadSeleccion } from "@prisma/client";

export type CarpetaContractualData = {
  id: string;
  numero: string;
  numeroContrato: string | null;
  objeto: string;
  modalidadSeleccion: ModalidadSeleccion;
  etapaActual: EtapaContratacion;
  cerrado: boolean;
  dependencia: string;
  contratista: string | null;
  documentos: number;
};

export function CarpetaExpedienteContractual({ c }: { c: CarpetaContractualData }) {
  return (
    <Link
      href={`/contratacion/expedientes/${c.id}`}
      className={`group relative mt-3 block rounded-lg rounded-tl-none border pb-3 pl-3.5 pr-3.5 pt-3 transition ${
        c.cerrado
          ? "border-stone-200 bg-stone-50 hover:border-stone-200"
          : "border-amber-200/80 bg-amber-50/50 hover:border-amber-300"
      }`}
    >
      <span
        className={`absolute -top-3 left-0 flex h-3 items-center rounded-t-md border border-b-0 px-2 ${
          c.cerrado ? "border-stone-200 bg-stone-100" : "border-amber-200/80 bg-amber-100"
        }`}
      >
        <span className="sr-only">Carpeta</span>
        <span className="h-1 w-8 rounded-full bg-black/10" aria-hidden />
      </span>

      <div className="flex items-start justify-between gap-2">
        <span className={`font-mono text-sm font-semibold ${c.cerrado ? "text-stone-600" : "text-cdmb-800"}`}>{c.numero}</span>
        <span
          className={`inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            c.cerrado ? "bg-stone-200/70 text-stone-600" : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {c.cerrado ? <Lock className="h-2.5 w-2.5" aria-hidden /> : <FolderOpen className="h-2.5 w-2.5" aria-hidden />}
          {c.cerrado ? "Cerrado" : ETIQUETA_ETAPA[c.etapaActual]}
        </span>
      </div>

      {c.numeroContrato && <p className="mt-0.5 font-mono text-xs text-stone-500">Contrato {c.numeroContrato}</p>}
      <p className="mt-1 line-clamp-2 text-sm text-stone-700">{c.objeto}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-black/5 pt-2 text-[11px] text-stone-500">
        <span className="truncate">{c.dependencia}</span>
        <span className="truncate">{ETIQUETA_MODALIDAD[c.modalidadSeleccion]}</span>
        {c.contratista && (
          <span className="flex items-center gap-1 truncate">
            <User className="h-3 w-3 flex-none" aria-hidden />
            {c.contratista}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Files className="h-3 w-3" aria-hidden />
          {c.documentos} documento{c.documentos === 1 ? "" : "s"}
        </span>
      </div>
    </Link>
  );
}
