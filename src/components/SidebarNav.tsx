"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Leaf,
  Link2,
  Archive,
  Mail,
  Briefcase,
  UserCog,
  ShieldCheck,
  Palette,
  Lock,
  LayoutGrid,
  FolderClock,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; exacto?: boolean; prefijo?: string | string[] };

const ITEM_TRAMITES: Item = {
  href: "/",
  label: "Trámites ambientales 2.0",
  icon: Leaf,
  prefijo: ["/", "/tramites", "/expedientes", "/solicitantes", "/visor-tramites", "/firmas"],
};
const ITEM_VITAL: Item = { href: "/vital", label: "VITAL", icon: Link2, prefijo: "/vital" };
const ITEM_HISTORICO: Item = { href: "/historico/solicitudes", label: "SINCA 1.0", icon: Archive, prefijo: "/historico" };
const ITEM_CORRESPONDENCIA: Item = { href: "/correspondencia/panel", label: "SGDEA CDMB", icon: Mail, prefijo: "/correspondencia" };
const ITEM_CONTRATACION: Item = { href: "/contratacion/panel", label: "GECON", icon: Briefcase, prefijo: "/contratacion" };

const ITEMS_ADMIN: Item[] = [
  { href: "/usuarios", label: "Usuarios", icon: UserCog },
  { href: "/auditoria", label: "Auditoría", icon: ShieldCheck },
  { href: "/admin/apariencia", label: "Apariencia", icon: Palette },
  { href: "/admin/seguridad", label: "Seguridad", icon: Lock },
  { href: "/admin/modulos", label: "Módulos", icon: LayoutGrid },
  { href: "/admin/trd", label: "Clasificación TRD", icon: FolderClock },
];

export function SidebarNav({
  esAdmin,
  mostrarTramites = true,
  mostrarVital = false,
  mostrarSinca = false,
  mostrarCorrespondencia = false,
  mostrarContratacion = false,
  colapsado = false,
}: {
  esAdmin: boolean;
  mostrarTramites?: boolean;
  mostrarVital?: boolean;
  mostrarSinca?: boolean;
  mostrarCorrespondencia?: boolean;
  mostrarContratacion?: boolean;
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
    ...(mostrarTramites ? [ITEM_TRAMITES] : []),
    ...(mostrarCorrespondencia ? [ITEM_CORRESPONDENCIA] : []),
    ...(mostrarContratacion ? [ITEM_CONTRATACION] : []),
    ...(mostrarVital ? [ITEM_VITAL] : []),
    ...(mostrarSinca ? [ITEM_HISTORICO] : []),
  ];

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-3" aria-label="Navegación">
      <Grupo items={principal} activo={activo} colapsado={colapsado} />
      {esAdmin && <Grupo titulo="Administración" items={ITEMS_ADMIN} activo={activo} colapsado={colapsado} />}
    </nav>
  );
}

function Grupo({ titulo, items, activo, colapsado }: { titulo?: string; items: Item[]; activo: (item: Item) => boolean; colapsado: boolean }) {
  return (
    <div>
      {titulo && !colapsado && (
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">{titulo}</p>
      )}
      <ul className="space-y-0.5">
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
    <Link prefetch={false}
      href={item.href}
      aria-current={activo ? "page" : undefined}
      title={colapsado ? item.label : undefined}
      className={`flex items-center whitespace-nowrap rounded-xl text-sm font-medium transition-all ${
        colapsado ? "justify-center px-0 py-1.5" : "gap-3 px-3 py-1.5"
      } ${activo ? "bg-menu-500 text-stone-900" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
    >
      <span
        className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg transition-colors ${
          activo ? "bg-white/60 text-stone-900" : "text-white/70"
        }`}
      >
        <Icon className="h-[17px] w-[17px]" aria-hidden />
      </span>
      <span className={colapsado ? "sr-only" : undefined}>{item.label}</span>
    </Link>
  );
}
