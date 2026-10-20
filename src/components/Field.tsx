import type { ReactNode } from "react";
import { Info } from "lucide-react";

export function Field({
  label,
  help,
  required,
  icon,
  children,
}: {
  label: string;
  help?: string;
  required?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-700">
        {icon && (
          <span className="text-cdmb-600" aria-hidden>
            {icon}
          </span>
        )}
        {label} {required && <span className="text-red-500">*</span>}
        {help && (
          <span title={help} aria-label={help} className="inline-flex cursor-help text-stone-400 hover:text-cdmb-600">
            <Info className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

export function SectionHelp({ children }: { children: ReactNode }) {
  return (
    <details className="group relative z-10 float-right mb-1 ml-2">
      <summary
        aria-label="Ayuda"
        title="Ayuda"
        className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-sm text-stone-400 hover:bg-stone-100 hover:text-cdmb-600 group-open:text-cdmb-600 [&::-webkit-details-marker]:hidden"
      >
        <Info className="h-4 w-4" aria-hidden />
      </summary>
      <div className="absolute right-0 top-7 w-80 rounded-md border border-stone-200 bg-white p-3 text-[13px] leading-snug text-stone-600 shadow-soft-lg">
        {children}
      </div>
    </details>
  );
}
