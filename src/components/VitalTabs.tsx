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
    <nav
      className="flex flex-wrap items-center gap-1 rounded-xl border border-stone-200 bg-stone-50/80 p-1"
      aria-label="Secciones de VITAL"
    >
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
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activo ? "bg-white text-cdmb-800 shadow-sm ring-1 ring-stone-200" : "text-stone-500 hover:bg-white/70 hover:text-stone-800"
            }`}
          >
            <Icon className={`h-4 w-4 ${activo ? "text-cdmb-600" : "text-stone-400"}`} aria-hidden />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
