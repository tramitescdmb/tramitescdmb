"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";
import { useMenuModulo } from "@/components/MenuModulo";
import { SubmenuModulo } from "@/components/SubmenuModulo";
import { EVENTO_AVISOS, ultimosAvisos } from "@/components/CampanaAvisos";
import {
  IconHome,
  IconFileCertificate,
  IconPlugConnected,
  IconArchive,
  IconInbox,
  IconBriefcase,
  IconUserCog,
  IconKey,
  IconLayoutDashboard,
  IconShieldCheck,
  IconPalette,
  IconLock,
  IconLayoutGrid,
  IconNumbers,
  type Icon as TablerIcon,
} from "@tabler/icons-react";

export type Item = { href: string; label: string; icon: TablerIcon; exacto?: boolean; prefijo?: string | string[] };

export const ITEM_INICIO: Item = { href: "/", label: "Inicio", icon: IconHome, exacto: true };
export const ITEM_DASHBOARD: Item = { href: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard, prefijo: "/dashboard" };

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
  { href: "/admin/roles", label: "Roles", icon: IconKey },
  { href: "/auditoria", label: "Auditoría", icon: IconShieldCheck },
  { href: "/admin/apariencia", label: "Apariencia", icon: IconPalette },
  { href: "/admin/seguridad", label: "Seguridad", icon: IconLock },
  { href: "/admin/modulos", label: "Módulos", icon: IconLayoutGrid },
  { href: "/admin/consecutivos", label: "Consecutivos", icon: IconNumbers },
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
  const { menu } = useMenuModulo();
  const [pendientes, setPendientes] = useState<Record<string, { total: number; detalle: string }>>({});
  useEffect(() => {
    const agrupar = (avisos: { modulo?: string; titulo: string; cantidad: number; alerta: boolean }[]) => {
      const r: Record<string, { total: number; detalle: string }> = {};
      for (const a of avisos) {
        if (!a.modulo || !a.alerta) continue;
        const x = (r[a.modulo] ??= { total: 0, detalle: "" });
        x.total += a.cantidad;
        x.detalle = x.detalle ? `${x.detalle}; ${a.titulo}` : a.titulo;
      }
      setPendientes(r);
    };
    const recibir = (e: Event) => agrupar((e as CustomEvent<Parameters<typeof agrupar>[0]>).detail ?? []);
    agrupar(ultimosAvisos());
    window.addEventListener(EVENTO_AVISOS, recibir);
    return () => window.removeEventListener(EVENTO_AVISOS, recibir);
  }, []);
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
    ITEM_DASHBOARD,
    ...(mostrarTramites ? [ITEM_TRAMITES] : []),
    ...(mostrarCorrespondencia ? [ITEM_CORRESPONDENCIA] : []),
    ...(mostrarContratacion ? [ITEM_CONTRATACION] : []),
    ...(mostrarVital ? [ITEM_VITAL] : []),
    ...(mostrarSinca ? [ITEM_HISTORICO] : []),
  ];

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-2" aria-label="Navegación">
      <Grupo items={principal} activo={activo} colapsado={colapsado} pendientes={pendientes} submenu={!colapsado && menu ? <SubmenuModulo menu={menu} /> : null} />
      {esAdmin && <Grupo titulo="Administración" items={ITEMS_ADMIN} activo={activo} colapsado={colapsado} />}
    </nav>
  );
}

function Grupo({
  titulo,
  items,
  activo,
  colapsado,
  submenu,
  pendientes = {},
}: {
  titulo?: string;
  items: Item[];
  activo: (item: Item) => boolean;
  colapsado: boolean;
  submenu?: React.ReactNode;
  pendientes?: Record<string, { total: number; detalle: string }>;
}) {
  return (
    <div>
      {titulo && !colapsado && (
        <p className="mb-1 px-5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">{titulo}</p>
      )}
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <EnlaceNav
              item={item}
              activo={activo(item)}
              colapsado={colapsado}
              desplegado={Boolean(submenu) && activo(item) && item !== ITEM_INICIO && item !== ITEM_DASHBOARD}
              pendiente={MODULO_DE_ITEM[item.href] ? pendientes[MODULO_DE_ITEM[item.href]!] : undefined}
            />
            {submenu && activo(item) && item !== ITEM_INICIO && item !== ITEM_DASHBOARD && submenu}
          </li>
        ))}
      </ul>
    </div>
  );
}

const MODULO_DE_ITEM: Record<string, string> = {
  [ITEM_TRAMITES.href]: "TRAMITES",
  [ITEM_CORRESPONDENCIA.href]: "SGDEA",
  [ITEM_CONTRATACION.href]: "GECON",
};

function EnlaceNav({
  item,
  activo,
  colapsado,
  desplegado,
  pendiente,
}: {
  item: Item;
  activo: boolean;
  colapsado: boolean;
  desplegado?: boolean;
  pendiente?: { total: number; detalle: string };
}) {
  const Icon = item.icon;
  return (
    <Link prefetch={false}
      href={item.href}
      aria-current={activo ? "page" : undefined}
      title={colapsado ? item.label : undefined}
      className={`relative flex items-center whitespace-nowrap border-l-[3px] text-[14px] transition-colors ${
        colapsado ? "justify-center px-0 py-3" : "gap-3 px-[17px] py-2.5"
      } ${activo ? "border-menu-500 bg-black/20 font-semibold text-menu-500" : "border-transparent text-white/85 hover:bg-white/5 hover:text-white"}`}
    >
      <Icon className="h-5 w-5 flex-none" stroke={1.75} aria-hidden />
      <span className={colapsado ? "sr-only" : "min-w-0 flex-1 truncate"}>{item.label}</span>
      {pendiente && pendiente.total > 0 && (
        <span
          title={pendiente.detalle}
          aria-label={pendiente.detalle}
          className={colapsado ? "absolute ml-5 -mt-5 h-2 w-2 rounded-full bg-red-600" : "flex-none rounded-sm bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"}
        >
          {colapsado ? null : pendiente.total}
        </span>
      )}
      {desplegado && <IconChevronDown className="h-4 w-4 flex-none opacity-80" stroke={1.75} aria-hidden />}
    </Link>
  );
}
