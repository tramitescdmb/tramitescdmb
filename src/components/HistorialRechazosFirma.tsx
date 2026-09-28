import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { formatearFechaHora } from "@/lib/fecha";
import type { RechazoFirmaHistorial } from "@/lib/solicitudes-firma";

export function HistorialRechazosFirma({
  rechazos,
  hrefExpediente,
}: {
  rechazos: RechazoFirmaHistorial[];
  hrefExpediente: (expedienteId: string) => string;
}) {
  if (rechazos.length === 0) return null;
  return (
    <details className="group rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
        <span className="text-xs font-medium text-stone-700">Historial de rechazos</span>
        <span className="flex items-center gap-1.5 text-xs text-stone-400">
          {rechazos.length} rechazo{rechazos.length === 1 ? "" : "s"}
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <p className="mt-2 text-xs text-stone-500">
        Registro permanente de los rechazos, aunque el aviso ya se haya descartado o el archivo se haya corregido.
      </p>
      <ul className="mt-2 divide-y divide-stone-100 text-xs">
        {rechazos.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className="min-w-0 flex-1 text-stone-700">
              <span className="font-medium">{r.documentoNombre}</span>
              {r.motivo && <span className="text-stone-500"> — {r.motivo}</span>}
            </span>
            <Link href={hrefExpediente(r.expedienteId)} className="flex-none text-cdmb-700 hover:underline" title="Ir al expediente completo">
              {r.expedienteNumero}
            </Link>
            <span className="flex-none text-stone-400" title={`Subido por ${r.subidoPor}`}>Rechazó: {r.rechazadoPor}</span>
            <span className="flex-none text-stone-400">{formatearFechaHora(r.fecha)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
