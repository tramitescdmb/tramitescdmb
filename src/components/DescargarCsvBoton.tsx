import { Download } from "lucide-react";

/** Único botón "Descargar CSV" — se ubica arriba a la derecha de la pantalla, junto al título. */
export function DescargarCsvBoton({ href, label = "Descargar CSV" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      className="inline-flex flex-none items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2.5 text-sm font-medium text-stone-700 transition-all hover:bg-stone-50 hover:shadow-sm active:scale-95"
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
      {label}
    </a>
  );
}
