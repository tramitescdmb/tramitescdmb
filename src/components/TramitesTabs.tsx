"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LibraryBig, FolderOpen, Users } from "lucide-react";

const TABS = [
  { href: "/", label: "Panel", icon: LayoutDashboard, exacto: true },
  { href: "/tramites", label: "Catálogo de trámites", icon: LibraryBig },
  { href: "/expedientes", label: "Expedientes", icon: FolderOpen },
  { href: "/solicitantes", label: "Solicitantes", icon: Users, requiereTramite: true },
];

export function TramitesTabs({ mostrarSolicitantes = true }: { mostrarSolicitantes?: boolean }) {
  const pathname = usePathname();
  const tabs = mostrarSolicitantes ? TABS : TABS.filter((t) => !t.requiereTramite);
  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-stone-50/80 p-1"
      aria-label="Trámites ambientales"
    >
      {tabs.map((t) => {
        const activo = t.exacto ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activo ? "page" : undefined}
            className={`flex flex-none items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
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
