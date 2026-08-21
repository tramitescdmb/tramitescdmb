import type { ReactNode } from "react";

/**
 * Envoltorio estándar para campos de formulario: label + control + texto de ayuda.
 * Se usa en todos los formularios de la app para que quede siempre visible
 * qué información se espera en cada campo.
 */
export function Field({
  label,
  help,
  required,
  children,
}: {
  label: string;
  help?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
    </div>
  );
}

export function SectionHelp({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex gap-2 rounded-md bg-cdmb-50 px-3 py-2 text-sm text-cdmb-800">
      <span aria-hidden className="mt-0.5">
        ℹ️
      </span>
      <p>{children}</p>
    </div>
  );
}
