"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListOrdered, Sparkles } from "lucide-react";

const TABS = [
  { href: "/historico/solicitudes", label: "Solicitudes", icon: ListOrdered },
  { href: "/historico", label: "Dashboard", icon: LayoutDashboard, exacto: true },
  { href: "/historico/mineria", label: "Minería de datos", icon: Sparkles, exacto: true },
];

export function HistoricoTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-stone-200" aria-label="Secciones del histórico">
      {TABS.map((t) => {
        const activo = t.exacto ? pathname === t.href : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activo ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activo
                ? "border-cdmb-600 text-cdmb-800"
                : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
