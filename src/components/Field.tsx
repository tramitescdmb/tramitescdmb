import type { ReactNode } from "react";
import { Info } from "lucide-react";

/**
 * Envoltorio estándar para campos de formulario: label + control + texto de ayuda.
 * Se usa en todos los formularios de la app para que quede siempre visible
 * qué información se espera en cada campo.
 */
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

/**
 * Nota de contexto para una sección — no un aviso ni una alerta. Deliberadamente
 * discreta (borde de acento, sin relleno de color) para no competir visualmente
 * con el contenido real de la página. El texto debe ser breve y aportar algo que
 * no sea obvio por el propio formulario — evitar reexplicar lo que ya dicen los
 * labels o las opciones visibles.
 */
export function SectionHelp({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex gap-2 border-l-2 border-cdmb-300 bg-stone-50/80 py-1.5 pl-3 pr-3 text-[13px] leading-snug text-stone-600">
      <Info className="mt-0.5 h-3.5 w-3.5 flex-none text-cdmb-500" aria-hidden />
      <p>{children}</p>
    </div>
  );
}
