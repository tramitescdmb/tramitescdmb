"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  Settings2,
  FolderOpen,
  ShieldCheck,
  FileText,
  LayoutDashboard,
  ChevronDown,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";

type Permitido = { bandeja: boolean; expedientes: boolean; radicar: boolean; distribuir: boolean; admin: boolean };
type Clave = keyof Permitido;

type Item = { href: string; label: string; permiso?: Clave; prefijo?: boolean; externo?: boolean };
type Grupo = { label: string; icon: LucideIcon; permiso: Clave; href?: string; items?: Item[]; alinearDerecha?: boolean };

/** Rutas que NO son la bandeja aunque cuelguen de /correspondencia. */
const NO_BANDEJA = ["nueva", "admin", "panel", "plantillas", "disposicion", "expedientes", "reportes", "bitacora", "ayuda", "calendario-laboral"];
const esRutaBandeja = (p: string) =>
  p === "/correspondencia" ||
  (p.startsWith("/correspondencia/") && !NO_BANDEJA.some((s) => p.startsWith(`/correspondencia/${s}`)));

const GRUPOS: Grupo[] = [
  { label: "Panel", icon: LayoutDashboard, permiso: "bandeja", href: "/correspondencia/panel" },
  {
    label: "Correspondencia",
    icon: Inbox,
    permiso: "bandeja",
    items: [
      { href: "/correspondencia", label: "Bandeja de radicados" },
      { href: "/correspondencia/nueva", label: "Radicar recibida", permiso: "radicar" },
      { href: "/correspondencia/nueva/enviada", label: "Radicar enviada", permiso: "radicar" },
      { href: "/correspondencia/nueva/interna", label: "Radicar memorando", permiso: "radicar" },
      { href: "/correspondencia?tipo=RECIBIDA&estado=EN_REPARTO", label: "Distribución y reparto", permiso: "distribuir" },
    ],
  },
  {
    label: "Expedientes y archivo",
    icon: FolderOpen,
    permiso: "expedientes",
    items: [
      { href: "/correspondencia/expedientes", label: "Expedientes documentales", prefijo: true },
      { href: "/correspondencia/expedientes/nuevo", label: "Abrir expediente" },
      { href: "/correspondencia/disposicion", label: "Disposición final", permiso: "admin", prefijo: true },
    ],
  },
  { label: "Plantillas", icon: FileText, permiso: "bandeja", href: "/correspondencia/plantillas" },
  {
    label: "Configuración",
    icon: Settings2,
    permiso: "admin",
    alinearDerecha: true,
    items: [
      { href: "/correspondencia/admin", label: "Dependencias y TRD" },
      { href: "/correspondencia/admin/flujos", label: "Flujos de trabajo", prefijo: true },
      { href: "/correspondencia/admin/metadatos", label: "Campos de metadato", prefijo: true },
      { href: "/correspondencia/admin/vocabulario", label: "Vocabulario controlado", prefijo: true },
      { href: "/correspondencia/calendario-laboral", label: "Calendario laboral", prefijo: true },
    ],
  },
  {
    // MoReq cap. 6 (Control y Seguridad): usuarios, roles, contraseñas y auditoría son
    // parte del SGDEA. Hoy comparten pantalla con el resto de la app; cuando el SGDEA
    // se separe como módulo propio, estas rutas se namespacean bajo /correspondencia.
    label: "Administración",
    icon: ShieldCheck,
    permiso: "admin",
    alinearDerecha: true,
    items: [
      { href: "/correspondencia/bitacora", label: "Bitácora inalterable del SGDEA" },
      { href: "/usuarios", label: "Usuarios y roles", prefijo: true, externo: true },
      { href: "/auditoria", label: "Auditoría de cuentas", prefijo: true, externo: true },
      { href: "/admin/seguridad", label: "Seguridad (contraseñas, accesos)", prefijo: true, externo: true },
    ],
  },
];

function rutaDe(href: string) {
  return href.split("?")[0]!;
}

export function CorrespondenciaTabs({ permitido }: { permitido: Permitido }) {
  const pathname = usePathname();

  const itemActivo = (it: Item) => {
    // Atajos con filtros en la URL (?tipo=…) no son "una página": no se marcan activos.
    if (it.href.includes("?")) return false;
    const ruta = rutaDe(it.href);
    if (ruta === "/correspondencia") return esRutaBandeja(pathname);
    return it.prefijo ? pathname === ruta || pathname.startsWith(ruta + "/") : pathname === ruta;
  };

  const grupoActivo = (g: Grupo) => {
    if (g.href) {
      const ruta = rutaDe(g.href);
      return pathname === ruta || pathname.startsWith(ruta + "/");
    }
    return (g.items ?? []).some((it) => itemActivo(it));
  };

  const gruposVisibles = GRUPOS.map((g) => {
    if (!permitido[g.permiso]) return null;
    if (g.href) return { grupo: g, items: [] as Item[] };
    const items = (g.items ?? []).filter((it) => !it.permiso || permitido[it.permiso]);
    return items.length > 0 ? { grupo: g, items } : null;
  }).filter((x): x is { grupo: Grupo; items: Item[] } => x !== null);

  return (
    <nav
      className="flex flex-wrap items-center gap-1 border-b border-stone-200 pb-px"
      aria-label="Secciones del SGDEA"
    >
      {gruposVisibles.map(({ grupo, items }) =>
        grupo.href ? (
          <EnlaceSimple key={grupo.label} grupo={grupo} activo={grupoActivo(grupo)} />
        ) : (
          <MenuGrupo
            key={grupo.label}
            grupo={grupo}
            items={items}
            activo={grupoActivo(grupo)}
            itemActivo={itemActivo}
          />
        ),
      )}
    </nav>
  );
}

function claseTab(activo: boolean) {
  return `-mb-px flex items-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
    activo
      ? "border-cdmb-600 bg-cdmb-50/70 text-cdmb-800"
      : "border-transparent text-stone-500 hover:bg-stone-50 hover:text-stone-800"
  }`;
}

function EnlaceSimple({ grupo, activo }: { grupo: Grupo; activo: boolean }) {
  const Icon = grupo.icon;
  return (
    <Link href={grupo.href!} aria-current={activo ? "page" : undefined} className={claseTab(activo)}>
      <Icon className={`h-4 w-4 ${activo ? "text-cdmb-600" : "text-stone-400"}`} aria-hidden />
      {grupo.label}
    </Link>
  );
}

function MenuGrupo({
  grupo,
  items,
  activo,
  itemActivo,
}: {
  grupo: Grupo;
  items: Item[];
  activo: boolean;
  itemActivo: (it: Item) => boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const pathname = usePathname();
  const Icon = grupo.icon;

  // Cerrar al cambiar de ruta.
  useEffect(() => setAbierto(false), [pathname]);

  // Cerrar al hacer clic afuera o pulsar Escape.
  useEffect(() => {
    if (!abierto) return;
    const alClic = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    };
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    document.addEventListener("mousedown", alClic);
    document.addEventListener("keydown", alTeclado);
    return () => {
      document.removeEventListener("mousedown", alClic);
      document.removeEventListener("keydown", alTeclado);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className="relative">
      <button
        ref={boton}
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={menuId}
        onClick={() => setAbierto((v) => !v)}
        className={claseTab(activo)}
      >
        <Icon className={`h-4 w-4 ${activo ? "text-cdmb-600" : "text-stone-400"}`} aria-hidden />
        {grupo.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {abierto && (
        <div
          id={menuId}
          role="menu"
          aria-label={grupo.label}
          className={`absolute top-full z-20 mt-1 min-w-[15rem] rounded-lg border border-stone-200 bg-white p-1 shadow-lg ${
            grupo.alinearDerecha ? "right-0" : "left-0"
          }`}
        >
          {items.map((it) => {
            const act = itemActivo(it);
            return (
              <Link
                key={it.href}
                href={it.href}
                role="menuitem"
                aria-current={act ? "page" : undefined}
                className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  act ? "bg-cdmb-50 font-medium text-cdmb-800" : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                }`}
              >
                {it.label}
                {it.externo && <ExternalLink className="h-3.5 w-3.5 flex-none text-stone-300" aria-hidden />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
