"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LibraryBig,
  FolderOpen,
  Users,
  Link2,
  UserCog,
  ShieldCheck,
  Palette,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; exacto?: boolean };

const ITEMS_PRINCIPAL: Item[] = [
  { href: "/", label: "Panel", icon: LayoutDashboard, exacto: true },
  { href: "/tramites", label: "Catálogo de trámites", icon: LibraryBig },
  { href: "/expedientes", label: "Expedientes", icon: FolderOpen },
  { href: "/solicitantes", label: "Solicitantes", icon: Users },
  { href: "/vital", label: "VITAL", icon: Link2 },
];

const ITEMS_ADMIN: Item[] = [
  { href: "/usuarios", label: "Usuarios", icon: UserCog },
  { href: "/auditoria", label: "Auditoría", icon: ShieldCheck },
  { href: "/admin/apariencia", label: "Apariencia", icon: Palette },
];

/**
 * Lista de navegación compartida entre el sidebar de escritorio y la barra
 * compacta de pantallas chicas — la única diferencia es el contenedor que la
 * envuelve (columna vs. fila), así que el resaltado del enlace activo (que
 * necesita usePathname, por eso "use client") vive en un solo lugar.
 */
export function SidebarNav({ esAdmin, orientacion = "vertical" }: { esAdmin: boolean; orientacion?: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  const activo = (href: string, exacto?: boolean) => (exacto ? pathname === href : pathname === href || pathname.startsWith(href + "/"));

  if (orientacion === "horizontal") {
    const items = [...ITEMS_PRINCIPAL, ...(esAdmin ? ITEMS_ADMIN : [])];
    return (
      <nav className="flex gap-1 overflow-x-auto" aria-label="Navegación">
        {items.map((item) => (
          <EnlaceNav key={item.href} item={item} activo={activo(item.href, item.exacto)} compacto />
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4" aria-label="Navegación">
      <Grupo items={ITEMS_PRINCIPAL} activo={activo} />
      {esAdmin && <Grupo titulo="Administración" items={ITEMS_ADMIN} activo={activo} />}
    </nav>
  );
}

function Grupo({ titulo, items, activo }: { titulo?: string; items: Item[]; activo: (href: string, exacto?: boolean) => boolean }) {
  return (
    <div>
      {titulo && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{titulo}</p>}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <EnlaceNav item={item} activo={activo(item.href, item.exacto)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EnlaceNav({ item, activo, compacto }: { item: Item; activo: boolean; compacto?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={activo ? "page" : undefined}
      className={`flex items-center gap-3 whitespace-nowrap rounded-lg font-medium transition-colors ${
        compacto ? "px-3 py-2 text-sm" : "px-3 py-2.5 text-sm"
      } ${activo ? "bg-cdmb-50 text-cdmb-800" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"}`}
    >
      <Icon className={`h-[18px] w-[18px] flex-none ${activo ? "text-cdmb-600" : "text-stone-400"}`} aria-hidden />
      {item.label}
    </Link>
  );
}
