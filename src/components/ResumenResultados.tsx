import { ListFilter } from "lucide-react";

export function ResumenResultados({ total, detalle }: { total: number; detalle?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-cdmb-200 bg-cdmb-50 px-4 py-3 text-sm text-cdmb-900">
      <ListFilter className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
      <p>
        <span className="font-semibold">{total}</span> resultado{total === 1 ? "" : "s"}
        {detalle ? ` ${detalle}` : " en total"}.
      </p>
    </div>
  );
}
