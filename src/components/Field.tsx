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
      </label>
      {children}
      {help && <p className="mt-1 text-xs text-stone-500">{help}</p>}
    </div>
  );
}

export function SectionHelp({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex gap-2.5 rounded-xl bg-white/80 px-3.5 py-2 text-[13px] leading-snug text-stone-600 ring-1 ring-stone-200/70">
      <Info className="mt-0.5 h-3.5 w-3.5 flex-none text-cdmb-600" aria-hidden />
      <p>{children}</p>
    </div>
  );
}
