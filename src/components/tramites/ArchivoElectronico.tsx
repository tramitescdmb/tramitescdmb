import Link from "next/link";
import type { ReactNode } from "react";
import { FolderCheck, Lock, Files } from "lucide-react";
import { formatearFecha } from "@/lib/fecha";

export type CarpetaTramite = {
  id: string;
  numero: string;
  tramite: string;
  solicitante: string;
  identificacion: string;
  municipio: string;
  resultado: string;
  archivadoEn: Date | null;
  documentos: number;
};

/** Carpeta de un expediente electrónico archivado (mismo aspecto que el archivo del SGDEA). */
export function CarpetaExpedienteTramite({ c }: { c: CarpetaTramite }) {
  return (
    <Link
      prefetch={false}
      href={`/expediente-electronico/${c.id}`}
      className="group relative mt-3 block rounded-lg rounded-tl-none border border-stone-200 bg-stone-50 pb-3 pl-3.5 pr-3.5 pt-3 transition hover:border-cdmb-300 hover:bg-white"
    >
      <span className="absolute -top-3 left-0 flex h-3 items-center rounded-t-md border border-b-0 border-stone-200 bg-stone-100 px-2">
        <span className="sr-only">Carpeta</span>
        <span className="h-1 w-8 rounded-full bg-black/10" aria-hidden />
      </span>
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-stone-700 group-hover:text-cdmb-800">{c.numero}</span>
        <span className="inline-flex flex-none items-center gap-1 rounded-sm bg-stone-200/70 px-2 py-0.5 text-[10px] font-medium text-stone-600">
          <Lock className="h-2.5 w-2.5" aria-hidden />
          {c.resultado}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-stone-700">{c.solicitante}</p>
      <p className="truncate text-xs text-stone-500">
        {c.identificacion} · {c.municipio}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-black/5 pt-2 text-[11px] text-stone-500">
        <span className="flex items-center gap-1">
          <Files className="h-3 w-3" aria-hidden />
          {c.documentos} archivo{c.documentos === 1 ? "" : "s"}
        </span>
        {c.archivadoEn && <span>Archivado el {formatearFecha(c.archivadoEn)}</span>}
      </div>
    </Link>
  );
}

/** Cajón plegable (año o tipo de trámite) del archivo. */
export function CajonArchivo({
  nombre,
  total,
  abierto,
  nivel = 1,
  children,
}: {
  nombre: string;
  total: number;
  abierto: boolean;
  nivel?: 1 | 2;
  children: ReactNode;
}) {
  return (
    <details open={abierto} className={nivel === 1 ? "rounded-xl border border-stone-200 bg-stone-50/50" : "rounded-lg border border-stone-200/70 bg-white"}>
      <summary
        className={`flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-stone-700 hover:bg-stone-100/60 ${
          nivel === 1 ? "text-sm" : "text-[13px]"
        }`}
      >
        <FolderCheck className="h-4 w-4 flex-none text-stone-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{nombre}</span>
        <span className="rounded-sm bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-stone-500 ring-1 ring-stone-200">{total}</span>
      </summary>
      <div className={nivel === 1 ? "space-y-2 px-3 pb-3 pt-1" : "grid grid-cols-1 gap-x-3 gap-y-5 px-4 pb-4 pt-2 sm:grid-cols-2 lg:grid-cols-3"}>
        {children}
      </div>
    </details>
  );
}
