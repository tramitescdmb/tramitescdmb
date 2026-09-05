"use client";

import { Printer } from "lucide-react";

export function BotonImprimir({ children = "Imprimir" }: { children?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700 print:hidden"
    >
      <Printer className="h-4 w-4" aria-hidden />
      {children}
    </button>
  );
}
