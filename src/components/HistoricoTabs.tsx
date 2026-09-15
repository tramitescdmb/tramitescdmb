"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListOrdered, Sparkles, IdCard } from "lucide-react";

const TABS = [
  { href: "/historico/solicitudes", label: "Solicitudes", icon: ListOrdered, permiso: "base" as const },
  { href: "/historico/nits", label: "NIT / Terceros", icon: IdCard, permiso: "base" as const },
  { href: "/historico", label: "Dashboard", icon: LayoutDashboard, exacto: true, permiso: "dashboard" as const },
  { href: "/historico/mineria", label: "Minería de datos", icon: Sparkles, exacto: true, permiso: "mineria" as const },
];

export function HistoricoTabs({ permitido }: { permitido: { base: boolean; dashboard: boolean; mineria: boolean } }) {
  const pathname = usePathname();
  return (
    <nav
      className="flex flex-wrap items-center gap-1 rounded-xl border border-graphite-200 bg-graphite-50/80 p-1"
      aria-label="Secciones del histórico"
    >
      {TABS.filter((t) => permitido[t.permiso]).map((t) => {
        const activo = t.exacto ? pathname === t.href : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activo ? "page" : undefined}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activo
                ? "bg-white text-cdmb-800 shadow-sm ring-1 ring-graphite-200"
                : "text-graphite-500 hover:bg-white/70 hover:text-graphite-800"
            }`}
          >
            <Icon className={`h-4 w-4 ${activo ? "text-cdmb-600" : "text-graphite-400"}`} aria-hidden />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
