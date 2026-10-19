"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconHome,
  IconFileCertificate,
  IconPlugConnected,
  IconArchive,
  IconInbox,
  IconBriefcase,
  IconUserCog,
  IconShieldCheck,
  IconPalette,
  IconLock,
  IconLayoutGrid,
  IconFolders,
  type Icon as TablerIcon,
} from "@tabler/icons-react";

export type Item = { href: string; label: string; icon: TablerIcon; exacto?: boolean; prefijo?: string | string[] };

export const ITEM_INICIO: Item = { href: "/", label: "Inicio", icon: IconHome, exacto: true };

export const ITEM_TRAMITES: Item = {
  href: "/tramites-ambientales",
  label: "Trámites ambientales 2.0",
  icon: IconFileCertificate,
  prefijo: ["/tramites-ambientales", "/tramites", "/expedientes", "/solicitantes", "/visor-tramites", "/planeador", "/firmas"],
};
export const ITEM_VITAL: Item = { href: "/vital", label: "VITAL", icon: IconPlugConnected, prefijo: "/vital" };
export const ITEM_HISTORICO: Item = { href: "/historico/solicitudes", label: "SINCA 1.0", icon: IconArchive, prefijo: "/historico" };
export const ITEM_CORRESPONDENCIA: Item = { href: "/correspondencia/panel", label: "SGDEA CDMB", icon: IconInbox, prefijo: "/correspondencia" };
export const ITEM_CONTRATACION: Item = { href: "/contratacion/panel", label: "GECON", icon: IconBriefcase, prefijo: "/contratacion" };

export const ITEMS_ADMIN: Item[] = [
  { href: "/usuarios", label: "Usuarios", icon: IconUserCog },
  { href: "/auditoria", label: "Auditoría", icon: IconShieldCheck },
  { href: "/admin/apariencia", label: "Apariencia", icon: IconPalette },
  { href: "/admin/seguridad", label: "Seguridad", icon: IconLock },
  { href: "/admin/modulos", label: "Módulos", icon: IconLayoutGrid },
  { href: "/admin/trd", label: "Clasificación TRD", icon: IconFolders },
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
    ITEM_INICIO,
    ...(mostrarTramites ? [ITEM_TRAMITES] : []),
    ...(mostrarCorrespondencia ? [ITEM_CORRESPONDENCIA] : []),
    ...(mostrarContratacion ? [ITEM_CONTRATACION] : []),
    ...(mostrarVital ? [ITEM_VITAL] : []),
    ...(mostrarSinca ? [ITEM_HISTORICO] : []),
  ];

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-2" aria-label="Navegación">
      <Grupo items={principal} activo={activo} colapsado={colapsado} />
      {esAdmin && <Grupo titulo="Administración" items={ITEMS_ADMIN} activo={activo} colapsado={colapsado} />}
    </nav>
  );
}

function Grupo({ titulo, items, activo, colapsado }: { titulo?: string; items: Item[]; activo: (item: Item) => boolean; colapsado: boolean }) {
  return (
    <div>
      {titulo && !colapsado && (
        <p className="mb-1 px-5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">{titulo}</p>
      )}
      <ul>
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
      className={`flex items-center whitespace-nowrap border-l-[3px] text-[14px] transition-colors ${
        colapsado ? "justify-center px-0 py-3" : "gap-3 px-[17px] py-2.5"
      } ${activo ? "border-menu-500 bg-black/20 font-semibold text-menu-500" : "border-transparent text-white/85 hover:bg-white/5 hover:text-white"}`}
    >
      <Icon className="h-5 w-5 flex-none" stroke={1.75} aria-hidden />
      <span className={colapsado ? "sr-only" : undefined}>{item.label}</span>
    </Link>
  );
}
