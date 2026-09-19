"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, FilePlus2, Inbox, ChartColumn, UserSquare2, FileSignature, ListChecks } from "lucide-react";

const TABS = [
  { href: "/contratacion", label: "Panel", icon: LayoutDashboard, prefijoExacto: true, permiso: undefined },
  { href: "/contratacion/expedientes", label: "Expedientes", icon: Briefcase, permiso: undefined },
  { href: "/contratacion/buzon", label: "Buzón", icon: Inbox, permiso: undefined },
  { href: "/contratacion/mis-firmas", label: "Mis firmas", icon: FileSignature, permiso: undefined },
  { href: "/contratacion/dashboard", label: "Dashboard", icon: ChartColumn, permiso: undefined },
  { href: "/contratacion/contratistas", label: "Contratistas", icon: UserSquare2, permiso: "verContratistas" as const },
  { href: "/contratacion/catalogo", label: "Catálogo", icon: ListChecks, permiso: "soloAdministrador" as const },
  { href: "/contratacion/expedientes/nuevo", label: "Nuevo expediente", icon: FilePlus2, permiso: "administrar" as const },
];

export function ContratacionTabs({ permitido }: { permitido: { administrar: boolean; verContratistas: boolean; soloAdministrador: boolean } }) {
  const pathname = usePathname();
  const tabs = TABS.filter((t) => !t.permiso || permitido[t.permiso]);

  return (
    <nav
      className="flex flex-wrap items-center gap-1 rounded-xl border border-stone-200 bg-stone-50/80 p-1"
      aria-label="Secciones de Contratación"
    >
      {tabs.map((t) => {
        const activo = t.prefijoExacto ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
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
