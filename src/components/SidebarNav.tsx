"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Leaf,
  Link2,
  Archive,
  UserCog,
  ShieldCheck,
  Palette,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; exacto?: boolean; prefijo?: string | string[] };

const ITEMS_PRINCIPAL: Item[] = [
  {
    href: "/",
    label: "Trámites ambientales",
    icon: Leaf,
    prefijo: ["/", "/tramites", "/expedientes", "/solicitantes"],
  },
  { href: "/vital", label: "VITAL", icon: Link2, prefijo: "/vital" },
];

const ITEM_HISTORICO: Item = { href: "/historico/solicitudes", label: "SINCA 1.0", icon: Archive, prefijo: "/historico" };

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
export function SidebarNav({
  esAdmin,
  haySinca = false,
  orientacion = "vertical",
}: {
  esAdmin: boolean;
  haySinca?: boolean;
  orientacion?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const activo = (item: Item) => {
    if (item.prefijo) {
      const prefijos = Array.isArray(item.prefijo) ? item.prefijo : [item.prefijo];
      return prefijos.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")));
    }
    if (item.exacto) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  const principal = haySinca ? [...ITEMS_PRINCIPAL, ITEM_HISTORICO] : ITEMS_PRINCIPAL;

  if (orientacion === "horizontal") {
    const items = [...principal, ...(esAdmin ? ITEMS_ADMIN : [])];
    return (
      <nav className="flex gap-1 overflow-x-auto" aria-label="Navegación">
        {items.map((item) => (
          <EnlaceNav key={item.href} item={item} activo={activo(item)} compacto />
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4" aria-label="Navegación">
      <Grupo items={principal} activo={activo} />
      {esAdmin && <Grupo titulo="Administración" items={ITEMS_ADMIN} activo={activo} />}
    </nav>
  );
}

function Grupo({ titulo, items, activo }: { titulo?: string; items: Item[]; activo: (item: Item) => boolean }) {
  return (
    <div>
      {titulo && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{titulo}</p>}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <EnlaceNav item={item} activo={activo(item)} />
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
