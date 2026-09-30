import { FileSpreadsheet, FileText } from "lucide-react";

export function BotonExportar({ hrefXlsx, hrefCsv }: { hrefXlsx: string; hrefCsv: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-stone-400">Exportar:</span>
      <a
        href={hrefXlsx}
        className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
        Excel
      </a>
      <a
        href={hrefCsv}
        className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
        CSV
      </a>
    </div>
  );
}
