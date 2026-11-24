"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChevronDown, IconSettings } from "@tabler/icons-react";
import { useMenuModulo } from "@/components/MenuModulo";
import { SubmenuModulo } from "@/components/SubmenuModulo";
import { EVENTO_AVISOS, ultimosAvisos } from "@/components/CampanaAvisos";
import { RUTAS_DASHBOARD, itemActivo } from "@/lib/menu";
import {
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
  IconCalendarTime,
  IconMail,
  IconFileText,
  IconLeaf,
  type Icon as TablerIcon,
} from "@tabler/icons-react";

/**
 * `color`: tono propio del módulo (tripleta RGB). Son tonos claros que se leen bien sobre los seis colores
 * de menú (src/lib/tema-menu.ts), para que cada módulo se reconozca de un vistazo.
 */
export type Item = { href: string; label: string; icon: TablerIcon; exacto?: boolean; prefijo?: string | string[]; color?: string };

// Entrada única de inicio: abre «Mi trabajo» y, desde su selector, el Dashboard general y los de cada módulo.
export const ITEM_DASHBOARD: Item = { href: "/", label: "Dashboard", icon: IconLayoutDashboard, prefijo: RUTAS_DASHBOARD, color: "252 211 77" };

export const ITEM_TRAMITES: Item = {
  href: "/tramites-ambientales",
  label: "Trámites ambientales 2.0",
  icon: IconFileCertificate,
  prefijo: ["/tramites-ambientales", "/tramites", "/expedientes", "/expediente-electronico", "/solicitantes", "/visor-tramites", "/planeador", "/firmas"],
  color: "134 239 172",
};
export const ITEM_VITAL: Item = { href: "/vital", label: "VITAL", icon: IconPlugConnected, prefijo: "/vital", color: "249 168 212" };
export const ITEM_HISTORICO: Item = { href: "/historico/solicitudes", label: "SINCA 1.0", icon: IconArchive, prefijo: "/historico", color: "203 213 225" };
export const ITEM_CORRESPONDENCIA: Item = { href: "/correspondencia/panel", label: "SGDEA CDMB", icon: IconInbox, prefijo: "/correspondencia", color: "125 211 252" };
export const ITEM_MEMORANDOS: Item = { href: "/memorandos", label: "Memorandos", icon: IconFileText, prefijo: "/memorandos", color: "196 181 253" };
export const ITEM_NEGOCIOS_VERDES: Item = { href: "/negocios-verdes/admin", label: "Negocios Verdes", icon: IconLeaf, prefijo: "/negocios-verdes/admin", color: "190 242 100" };
export const ITEM_CONTRATACION: Item = { href: "/contratacion/panel", label: "GECON", icon: IconBriefcase, prefijo: "/contratacion", color: "253 186 116" };

export const ITEMS_ADMIN: Item[] = [
  { href: "/usuarios", label: "Usuarios", icon: IconUserCog },
  { href: "/admin/roles", label: "Roles", icon: IconKey },
  { href: "/auditoria", label: "Auditoría", icon: IconShieldCheck },
  { href: "/admin/apariencia", label: "Apariencia", icon: IconPalette },
  { href: "/admin/seguridad", label: "Seguridad", icon: IconLock },
  { href: "/admin/modulos", label: "Módulos", icon: IconLayoutGrid },
  { href: "/admin/consecutivos", label: "Consecutivos", icon: IconNumbers },
  { href: "/admin/procesos", label: "Procesos programados", icon: IconCalendarTime },
  { href: "/admin/correo", label: "Correo institucional", icon: IconMail },
];

export function SidebarNav({
  esAdmin,
  mostrarTramites = true,
  mostrarVital = false,
  mostrarSinca = false,
  mostrarCorrespondencia = false,
  mostrarContratacion = false,
  mostrarMemorandos = false,
  mostrarNegociosVerdes = false,
  colapsado = false,
}: {
  esAdmin: boolean;
  mostrarTramites?: boolean;
  mostrarVital?: boolean;
  mostrarSinca?: boolean;
  mostrarCorrespondencia?: boolean;
  mostrarContratacion?: boolean;
  mostrarMemorandos?: boolean;
  mostrarNegociosVerdes?: boolean;
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
  const activo = (item: Item) => itemActivo(item, pathname ?? "/");

  const principal = [
    ITEM_DASHBOARD,
    ...(mostrarTramites ? [ITEM_TRAMITES] : []),
    ...(mostrarCorrespondencia ? [ITEM_CORRESPONDENCIA] : []),
    ...(mostrarMemorandos ? [ITEM_MEMORANDOS] : []),
    ...(mostrarContratacion ? [ITEM_CONTRATACION] : []),
    ...(mostrarVital ? [ITEM_VITAL] : []),
    ...(mostrarSinca ? [ITEM_HISTORICO] : []),
    ...(mostrarNegociosVerdes ? [ITEM_NEGOCIOS_VERDES] : []),
  ];

  return (
    <nav className="scroll-menu flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-3" aria-label="Navegación">
      <Grupo titulo="Menú principal" items={principal} activo={activo} colapsado={colapsado} pendientes={pendientes} submenu={!colapsado && menu ? <SubmenuModulo menu={menu} /> : null} />
      {esAdmin && colapsado && <hr className="mx-3 border-white/10" aria-hidden />}
      {esAdmin && <GrupoAdministracion activo={activo} colapsado={colapsado} />}
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
  const [plegado, setPlegado] = useState<string | null>(null);
  return (
    <div>
      {titulo && !colapsado && (
        <p className="mb-1 px-5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/50">{titulo}</p>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href} className="relative">
            <EnlaceNav
              item={item}
              activo={activo(item)}
              colapsado={colapsado}
              conSubmenu={Boolean(submenu) && activo(item) && item !== ITEM_DASHBOARD}
              pendiente={MODULO_DE_ITEM[item.href] ? pendientes[MODULO_DE_ITEM[item.href]!] : undefined}
            />
            {submenu && activo(item) && item !== ITEM_DASHBOARD && (
              <>
                <button
                  type="button"
                  onClick={() => setPlegado(plegado === item.href ? null : item.href)}
                  aria-expanded={plegado !== item.href}
                  aria-label={plegado === item.href ? `Desplegar el menú de ${item.label}` : `Plegar el menú de ${item.label}`}
                  className="absolute right-3 top-1 flex h-8 w-8 items-center justify-center rounded text-lateral-acento hover:bg-white/10"
                >
                  <IconChevronDown className={`h-4 w-4 transition-transform ${plegado === item.href ? "-rotate-90" : ""}`} stroke={1.75} aria-hidden />
                </button>
                {plegado !== item.href && submenu}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const CLAVE_ADMIN_ABIERTA = "menu-admin-abierto";
const EVENTO_ADMIN = "menu-admin-abierto";

function leerAdminAbierta(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_ADMIN_ABIERTA) === "1";
  } catch {
    return false;
  }
}

function suscribirAdmin(aviso: () => void): () => void {
  window.addEventListener("storage", aviso);
  window.addEventListener(EVENTO_ADMIN, aviso);
  return () => {
    window.removeEventListener("storage", aviso);
    window.removeEventListener(EVENTO_ADMIN, aviso);
  };
}

/**
 * «Administración» aparece replegada: sus opciones solo se ven al hacer clic en el título.
 * Se abre sola cuando la página actual es de administración y recuerda (en este navegador) si se dejó abierta.
 */
function GrupoAdministracion({ activo, colapsado }: { activo: (item: Item) => boolean; colapsado: boolean }) {
  const enAdmin = ITEMS_ADMIN.some(activo);
  const guardada = useSyncExternalStore(suscribirAdmin, leerAdminAbierta, () => false);
  // Un clic manda mientras la persona siga dentro (o fuera) de las páginas de administración.
  const [manual, setManual] = useState<{ abierta: boolean; enAdmin: boolean } | null>(null);
  const abierta = manual && manual.enAdmin === enAdmin ? manual.abierta : enAdmin || guardada;
  const alternar = () => {
    const nueva = !abierta;
    setManual({ abierta: nueva, enAdmin });
    try {
      window.localStorage.setItem(CLAVE_ADMIN_ABIERTA, nueva ? "1" : "0");
      window.dispatchEvent(new Event(EVENTO_ADMIN));
    } catch {
      /* preferencia no guardada */
    }
  };
  return (
    <div>
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierta}
        aria-controls="menu-administracion"
        title={colapsado ? "Administración" : undefined}
        className={`group mx-2 flex w-[calc(100%-1rem)] items-center rounded-md transition-colors hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-lateral-acento ${
          colapsado ? "justify-center py-2.5" : "gap-3 py-2 pl-3 pr-3"
        } ${enAdmin && !abierta ? "bg-white/[0.10]" : ""}`}
      >
        {colapsado ? (
          <IconSettings className={`h-5 w-5 ${enAdmin ? "text-lateral-acento" : "text-white/70 group-hover:text-white"}`} stroke={1.75} aria-hidden />
        ) : (
          <span className="flex-1 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/60 group-hover:text-white/85">Administración</span>
        )}
        <span className="sr-only">{abierta ? "Plegar Administración" : "Desplegar Administración"}</span>
        {!colapsado && (
          <IconChevronDown className={`h-4 w-4 flex-none text-white/60 transition-transform ${abierta ? "" : "-rotate-90"}`} stroke={1.75} aria-hidden />
        )}
      </button>
      {abierta && (
        <div id="menu-administracion" className="mt-0.5">
          <Grupo items={ITEMS_ADMIN} activo={activo} colapsado={colapsado} />
        </div>
      )}
    </div>
  );
}

const MODULO_DE_ITEM: Record<string, string> = {
  [ITEM_TRAMITES.href]: "TRAMITES",
  [ITEM_CORRESPONDENCIA.href]: "SGDEA",
  [ITEM_MEMORANDOS.href]: "MEMORANDOS",
  [ITEM_CONTRATACION.href]: "GECON",
};

function EnlaceNav({
  item,
  activo,
  colapsado,
  conSubmenu,
  pendiente,
}: {
  item: Item;
  activo: boolean;
  colapsado: boolean;
  conSubmenu?: boolean;
  pendiente?: { total: number; detalle: string };
}) {
  const Icon = item.icon;
  const color = item.color;
  return (
    <Link prefetch={false}
      style={color ? ({ "--modulo": color } as React.CSSProperties) : undefined}
      href={item.href}
      aria-current={activo ? "page" : undefined}
      title={colapsado ? item.label : undefined}
      className={`group relative mx-2 flex items-center whitespace-nowrap rounded-md text-[14px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lateral-acento ${
        colapsado ? `justify-center px-0 ${color ? "py-1.5" : "py-2.5"}` : `gap-3 ${color ? "py-1.5 pl-2" : "py-2 pl-3"} ${conSubmenu ? "pr-10" : "pr-3"}`
      } ${
        activo
          ? `bg-white/[0.13] font-semibold text-white ${color ? "shadow-[inset_3px_0_0_rgb(var(--modulo))]" : "shadow-[inset_3px_0_0_rgb(var(--menu-acento))]"}`
          : "text-white/85 hover:bg-white/[0.07] hover:text-white"
      }`}
    >
      {color ? (
        <span
          className={`flex h-7 w-7 flex-none items-center justify-center rounded-md transition-colors ${
            activo ? "bg-[rgb(var(--modulo))] text-black/75" : "bg-[rgb(var(--modulo)/0.16)] text-[rgb(var(--modulo))] group-hover:bg-[rgb(var(--modulo)/0.26)]"
          }`}
          aria-hidden
        >
          <Icon className="h-[18px] w-[18px]" stroke={1.9} />
        </span>
      ) : (
        <Icon className={`h-5 w-5 flex-none transition-colors ${activo ? "text-lateral-acento" : "text-white/70 group-hover:text-white"}`} stroke={1.75} aria-hidden />
      )}
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
    </Link>
  );
}
