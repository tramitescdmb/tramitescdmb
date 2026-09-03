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
    <nav className="flex gap-1 overflow-x-auto border-b border-stone-200" aria-label="Trámites ambientales">
      {tabs.map((t) => {
        const activo = t.exacto ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activo ? "page" : undefined}
            className={`-mb-px flex flex-none items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
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
