"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Settings2, Archive, FolderOpen, History, FileText, LayoutDashboard } from "lucide-react";

type Permitido = { bandeja: boolean; expedientes: boolean; radicar: boolean; admin: boolean };

const TABS = [
  { href: "/correspondencia/panel", label: "Panel", icon: LayoutDashboard, permiso: "bandeja" as const },
  { href: "/correspondencia", label: "Bandeja", icon: Inbox, permiso: "bandeja" as const, prefijoExacto: true },
  { href: "/correspondencia/expedientes", label: "Expedientes", icon: FolderOpen, permiso: "expedientes" as const },
  { href: "/correspondencia/plantillas", label: "Plantillas", icon: FileText, permiso: "bandeja" as const },
  { href: "/correspondencia/disposicion", label: "Disposición final", icon: Archive, permiso: "admin" as const },
  { href: "/correspondencia/bitacora", label: "Bitácora", icon: History, permiso: "admin" as const },
  { href: "/correspondencia/admin", label: "Administración", icon: Settings2, permiso: "admin" as const },
];

export function CorrespondenciaTabs({ permitido }: { permitido: Permitido }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b border-stone-200 pb-px" aria-label="Secciones de correspondencia">
      {TABS.filter((t) => permitido[t.permiso]).map((t) => {
        const activo =
          t.href === "/correspondencia"
            ? pathname === "/correspondencia" ||
              (pathname.startsWith("/correspondencia/") &&
                !pathname.startsWith("/correspondencia/nueva") &&
                !pathname.startsWith("/correspondencia/admin") &&
                !pathname.startsWith("/correspondencia/panel") &&
                !pathname.startsWith("/correspondencia/plantillas") &&
                !pathname.startsWith("/correspondencia/disposicion") &&
                !pathname.startsWith("/correspondencia/expedientes") &&
                !pathname.startsWith("/correspondencia/reportes") &&
                !pathname.startsWith("/correspondencia/bitacora") &&
                !pathname.startsWith("/correspondencia/ayuda"))
            : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activo ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activo
                ? "border-cdmb-600 bg-cdmb-50/70 text-cdmb-800"
                : "border-transparent text-stone-500 hover:bg-stone-50 hover:text-stone-800"
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
