"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Leaf,
  Link2,
  Archive,
  Mail,
  UserCog,
  ShieldCheck,
  Palette,
  Lock,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; exacto?: boolean; prefijo?: string | string[] };

const ITEM_TRAMITES: Item = {
  href: "/",
  label: "Trámites ambientales 2.0",
  icon: Leaf,
  prefijo: ["/", "/tramites", "/expedientes", "/solicitantes"],
};
const ITEM_VITAL: Item = { href: "/vital", label: "VITAL", icon: Link2, prefijo: "/vital" };
const ITEM_HISTORICO: Item = { href: "/historico/solicitudes", label: "SINCA 1.0", icon: Archive, prefijo: "/historico" };
const ITEM_CORRESPONDENCIA: Item = { href: "/correspondencia/panel", label: "SGDEA CDMB", icon: Mail, prefijo: "/correspondencia" };

const ITEMS_ADMIN: Item[] = [
  { href: "/usuarios", label: "Usuarios", icon: UserCog },
  { href: "/auditoria", label: "Auditoría", icon: ShieldCheck },
  { href: "/admin/apariencia", label: "Apariencia", icon: Palette },
  { href: "/admin/seguridad", label: "Seguridad", icon: Lock },
];

/**
 * Lista de navegación compartida entre el sidebar de escritorio y el menú
 * (drawer) de pantallas chicas — el resaltado del enlace activo (que
 * necesita usePathname, por eso "use client") vive en un solo lugar.
 */
export function SidebarNav({
  esAdmin,
  mostrarVital = false,
  mostrarSinca = false,
  mostrarCorrespondencia = false,
  colapsado = false,
}: {
  esAdmin: boolean;
  /** VITAL tiene al menos una pestaña permitida para este usuario. */
  mostrarVital?: boolean;
  /** SINCA 1.0 está configurado en este despliegue Y tiene al menos una pestaña permitida. */
  mostrarSinca?: boolean;
  /** El usuario tiene acceso al módulo de correspondencia (SGDEA). */
  mostrarCorrespondencia?: boolean;
  /** Sidebar de escritorio reducido a una franja de íconos (ver Sidebar.tsx) — el menú móvil nunca pasa esto en true. */
  colapsado?: boolean;
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

  const principal = [
    ITEM_TRAMITES,
    ...(mostrarCorrespondencia ? [ITEM_CORRESPONDENCIA] : []),
    ...(mostrarVital ? [ITEM_VITAL] : []),
    ...(mostrarSinca ? [ITEM_HISTORICO] : []),
  ];

  return (
    <nav className="flex flex-1 flex-col gap-7 overflow-y-auto px-3 py-5" aria-label="Navegación">
      <Grupo items={principal} activo={activo} colapsado={colapsado} />
      {esAdmin && <Grupo titulo="Administración" items={ITEMS_ADMIN} activo={activo} colapsado={colapsado} />}
    </nav>
  );
}

function Grupo({ titulo, items, activo, colapsado }: { titulo?: string; items: Item[]; activo: (item: Item) => boolean; colapsado: boolean }) {
  return (
    <div>
      {titulo && !colapsado && (
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-graphite-400">{titulo}</p>
      )}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.href}>
            <EnlaceNav item={item} activo={activo(item)} colapsado={colapsado} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EnlaceNav({ item, activo, colapsado }: { item: Item; activo: boolean; colapsado: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={activo ? "page" : undefined}
      title={colapsado ? item.label : undefined}
      className={`flex items-center whitespace-nowrap rounded-xl text-sm font-medium transition-all ${
        colapsado ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
      } ${activo ? "bg-cdmb-50 text-cdmb-800" : "text-graphite-600 hover:bg-graphite-50 hover:text-graphite-900"}`}
    >
      <span
        className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg transition-colors ${
          activo ? "bg-white text-cdmb-600 shadow-sm" : "text-graphite-400"
        }`}
      >
        <Icon className="h-[17px] w-[17px]" aria-hidden />
      </span>
      <span className={colapsado ? "sr-only" : undefined}>{item.label}</span>
    </Link>
  );
}
