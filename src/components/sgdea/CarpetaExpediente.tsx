import Link from "next/link";
import { FolderOpen, FolderCheck, Lock, FileText, Layers } from "lucide-react";
import { ETIQUETA_NIVEL_ACCESO, CLASE_NIVEL_ACCESO } from "@/lib/nivel-acceso";

export type CarpetaData = {
  id: string;
  numero: string;
  asunto: string;
  dependencia: string;
  serie: string | null;
  estado: "ABIERTO" | "CERRADO";
  nivelAcceso: string;
  documentos: number;
  comunicaciones: number;
  folios: number | null;
  coincidencias?: string[];
};

/**
 * Un expediente como una carpeta física: pestaña arriba con el número (el
 * "rótulo del lomo"), el asunto, y en el pie los datos que sirven para
 * ubicarlo en el archivo (dependencia, serie, folios, piezas). Cerrada = con
 * candado y en tono neutro. Toda la tarjeta enlaza al detalle.
 */
export function CarpetaExpediente({ c }: { c: CarpetaData }) {
  const cerrada = c.estado === "CERRADO";
  const piezas = c.documentos + c.comunicaciones;

  return (
    <Link
      href={`/correspondencia/expedientes/${c.id}`}
      className={`group relative mt-3 block rounded-lg rounded-tl-none border pb-3 pl-3.5 pr-3.5 pt-3 transition ${
        cerrada
          ? "border-stone-200 bg-stone-50 hover:border-stone-300"
          : "border-amber-200/80 bg-amber-50/50 hover:border-amber-300"
      }`}
    >
      {/* pestaña */}
      <span
        className={`absolute -top-3 left-0 flex h-3 items-center rounded-t-md border border-b-0 px-2 ${
          cerrada ? "border-stone-200 bg-stone-100" : "border-amber-200/80 bg-amber-100"
        }`}
      >
        <span className="sr-only">Carpeta</span>
        <span className="h-1 w-8 rounded-full bg-black/10" aria-hidden />
      </span>

      <div className="flex items-start justify-between gap-2">
        <span className={`font-mono text-sm font-semibold ${cerrada ? "text-stone-600" : "text-cdmb-800"}`}>{c.numero}</span>
        <span
          className={`inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            cerrada ? "bg-stone-200/70 text-stone-600" : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {cerrada ? <Lock className="h-2.5 w-2.5" aria-hidden /> : <FolderOpen className="h-2.5 w-2.5" aria-hidden />}
          {cerrada ? "Cerrada" : "Abierta"}
        </span>
      </div>

      <p className="mt-1 line-clamp-2 text-sm text-stone-700">{c.asunto}</p>

      {c.coincidencias && c.coincidencias.length > 0 && (
        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-cdmb-600" title={c.coincidencias.join(", ")}>
          <FileText className="h-3 w-3 flex-none" aria-hidden />
          Coincide: {c.coincidencias.join(", ")}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-black/5 pt-2 text-[11px] text-stone-500">
        <span className="truncate">{c.serie ?? "Sin clasificar"}</span>
        <span className="flex items-center gap-1">
          <Layers className="h-3 w-3" aria-hidden />
          {piezas} pieza{piezas === 1 ? "" : "s"}
        </span>
        {c.folios != null && <span>{c.folios} folio{c.folios === 1 ? "" : "s"}</span>}
        {c.nivelAcceso !== "PUBLICA" && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CLASE_NIVEL_ACCESO[c.nivelAcceso] ?? ""}`}>
            {ETIQUETA_NIVEL_ACCESO[c.nivelAcceso] ?? c.nivelAcceso}
          </span>
        )}
      </div>
    </Link>
  );
}

/** Cajón / balda: agrupa las carpetas de una dependencia, como un cajón del archivador. */
export function CajonDependencia({
  nombre,
  total,
  abierto,
  children,
}: {
  nombre: string;
  total: number;
  abierto: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={abierto} className="rounded-xl border border-stone-200 bg-stone-50/50">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100/60">
        <FolderCheck className="h-4 w-4 flex-none text-stone-400" aria-hidden />
        {nombre}
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-stone-500">{total}</span>
      </summary>
      <div className="grid grid-cols-1 gap-x-3 gap-y-5 px-4 pb-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </details>
  );
}
