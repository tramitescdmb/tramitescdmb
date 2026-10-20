"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconLogout, IconUserCircle, type Icon as TablerIcon } from "@tabler/icons-react";
import { BuscadorGlobal } from "@/components/BuscadorGlobal";
import { CampanaAvisos } from "@/components/CampanaAvisos";
import {
  ITEM_INICIO,
  ITEM_DASHBOARD,
  ITEM_TRAMITES,
  ITEM_VITAL,
  ITEM_HISTORICO,
  ITEM_CORRESPONDENCIA,
  ITEM_CONTRATACION,
  ITEMS_ADMIN,
  type Item,
} from "@/components/SidebarNav";

const ITEM_MI_CUENTA: Item = { href: "/mi-cuenta", label: "Mi cuenta", icon: IconUserCircle };
const ITEMS: Item[] = [ITEM_DASHBOARD, ITEM_TRAMITES, ITEM_VITAL, ITEM_HISTORICO, ITEM_CORRESPONDENCIA, ITEM_CONTRATACION, ...ITEMS_ADMIN, ITEM_MI_CUENTA];

function coincide(item: Item, pathname: string) {
  const prefijos = item.prefijo ? (Array.isArray(item.prefijo) ? item.prefijo : [item.prefijo]) : [item.href];
  return prefijos.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function Miga({ icon: Icon, label, href, actual }: { icon: TablerIcon; label: string; href: string; actual?: boolean }) {
  const contenido = (
    <>
      <Icon className="h-[18px] w-[18px] flex-none" stroke={1.75} aria-hidden />
      <span className="truncate">{label}</span>
    </>
  );
  if (actual) {
    return (
      <span aria-current="page" className="flex min-w-0 items-center gap-1.5 text-stone-800">
        {contenido}
      </span>
    );
  }
  return (
    <Link prefetch={false} href={href} className="flex min-w-0 items-center gap-1.5 text-stone-600 hover:text-cdmb-700">
      {contenido}
    </Link>
  );
}

export function BarraSuperior({ nombre, subtitulo, iniciales }: { nombre: string; subtitulo: string; iniciales: string }) {
  const pathname = usePathname() ?? "/";
  const seccion = pathname === "/" ? null : ITEMS.find((item) => coincide(item, pathname));

  return (
    <header className="sticky top-0 z-30 hidden h-14 flex-none items-center justify-between gap-4 border-b border-stone-200 bg-white px-6 lg:flex print:hidden">
      <nav aria-label="Ruta" className="flex min-w-0 flex-none items-center gap-2 text-[15px]">
        <Miga icon={ITEM_INICIO.icon} label={ITEM_INICIO.label} href="/" actual={!seccion} />
        {seccion && (
          <>
            <span className="text-stone-400" aria-hidden>
              /
            </span>
            <Miga icon={seccion.icon} label={seccion.label} href={seccion.href} actual={pathname === seccion.href} />
          </>
        )}
      </nav>

      <div className="flex min-w-0 flex-1 justify-end px-2">
        <BuscadorGlobal />
      </div>

      <div className="flex flex-none items-center gap-1">
        <CampanaAvisos />
        <Link prefetch={false} href="/mi-cuenta" className="flex items-center gap-3 rounded px-2 py-1 hover:bg-stone-100">
          <div className="max-w-[16rem] text-right leading-tight">
            <p className="truncate text-sm font-medium text-stone-800">{nombre}</p>
            <p className="truncate text-xs text-stone-500" title={subtitulo}>
              {subtitulo}
            </p>
          </div>
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded bg-acento-500 text-sm font-semibold text-white">
            {iniciales}
          </span>
        </Link>
        <form action="/api/auth/logout" method="post">
          <button
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="flex h-9 w-9 items-center justify-center rounded text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
          >
            <IconLogout className="h-5 w-5" stroke={1.75} aria-hidden />
          </button>
        </form>
      </div>
    </header>
  );
}
