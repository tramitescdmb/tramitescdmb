"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Settings2 } from "lucide-react";

type Permitido = { bandeja: boolean; radicar: boolean; admin: boolean };

const TABS = [
  { href: "/correspondencia", label: "Bandeja", icon: Inbox, permiso: "bandeja" as const, prefijoExacto: true },
  { href: "/correspondencia/admin", label: "Administración", icon: Settings2, permiso: "admin" as const },
];

export function CorrespondenciaTabs({ permitido }: { permitido: Permitido }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b border-stone-200" aria-label="Secciones de correspondencia">
      {TABS.filter((t) => permitido[t.permiso]).map((t) => {
        const activo =
          t.href === "/correspondencia"
            ? pathname === "/correspondencia" || (pathname.startsWith("/correspondencia/") && !pathname.startsWith("/correspondencia/nueva") && !pathname.startsWith("/correspondencia/admin"))
            : pathname.startsWith(t.href);
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
