import { Download } from "lucide-react";

/**
 * Enlace de descarga a una ruta de API (CSV/XML/BPMN). `href` es una prop
 * dinámica a propósito: son endpoints, no páginas — no aplica `next/link`.
 */
export function EnlaceDescarga({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="flex items-center gap-1 font-medium text-cdmb-700 hover:underline">
      <Download className="h-3.5 w-3.5" aria-hidden />
      {children}
    </a>
  );
}
