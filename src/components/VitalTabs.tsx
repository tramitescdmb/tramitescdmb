"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, ListOrdered, LayoutDashboard } from "lucide-react";

const TABS = [
  { href: "/vital", label: "Solicitudes", icon: ListOrdered, permiso: "base" as const },
  { href: "/vital/recientes", label: "Recientes", icon: Inbox, permiso: "base" as const },
  { href: "/vital/dashboard", label: "Dashboard", icon: LayoutDashboard, permiso: "dashboard" as const },
];

export function VitalTabs({ permitido }: { permitido: { base: boolean; dashboard: boolean } }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-stone-200" aria-label="Secciones de VITAL">
      {TABS.filter((t) => permitido[t.permiso]).map((t) => {
        let activo: boolean;
        if (t.href === "/vital/dashboard") activo = pathname.startsWith("/vital/dashboard");
        else if (t.href === "/vital/recientes") activo = pathname.startsWith("/vital/recientes");
        else activo = !pathname.startsWith("/vital/dashboard") && !pathname.startsWith("/vital/recientes");
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activo ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activo ? "border-cdmb-600 text-cdmb-800" : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800"
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
