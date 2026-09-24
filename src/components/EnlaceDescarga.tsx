import { Download } from "lucide-react";

export function EnlaceDescarga({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="flex items-center gap-1 font-medium text-cdmb-700 hover:underline">
      <Download className="h-3.5 w-3.5" aria-hidden />
      {children}
    </a>
  );
}
