"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LockKeyhole, Menu, Search, X } from "lucide-react";

/** Menú del sitio público: mismos rótulos y orden de la plataforma anterior. */
export const MENU_NV = [
  ["/negocios-verdes", "Inicio"],
  ["/negocios-verdes/buscar", "Buscar"],
  ["/negocios-verdes/geovisor", "Geovisor Negocios Verdes"],
  ["/negocios-verdes/nosotros", "¿Qué son los Negocios Verdes?"],
  ["/negocios-verdes/plan-nacional", "Plan Nacional"],
  ["/negocios-verdes/contacto", "Contacto"],
] as const;

/**
 * Encabezado blanco con el logo, la lupa y el candado de acceso administrativo; debajo, el menú con
 * la opción activa en verde de menú y la franja verde de 3 px (igual que la plataforma anterior).
 */
export function EncabezadoNV({ logoUrl }: { logoUrl: string }) {
  const ruta = usePathname() ?? "";
  const [abierto, setAbierto] = useState(false);
  const activo = (href: string) => (href === "/negocios-verdes" ? ruta === href : ruta === href || ruta.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-[1100] bg-white print:static">
      <div className="px-4 pb-1 pt-2.5">
        <div className="flex items-center gap-2">
          <Link prefetch={false} href="/negocios-verdes" className="flex min-w-0 flex-1 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="CDMB" className="h-9 w-auto flex-none" />
            <span className="truncate text-lg font-bold text-nv-texto">Negocios Verdes CDMB</span>
          </Link>
          <Link prefetch={false} href="/negocios-verdes/buscar" aria-label="Buscar" title="Buscar" className="rounded-full p-2 text-nv-texto hover:bg-stone-100">
            <Search className="h-6 w-6" aria-hidden />
          </Link>
          <Link prefetch={false} href="/negocios-verdes/admin" aria-label="Acceso administrativo" title="Acceso administrativo" className="hidden rounded-full p-2 text-nv-texto2 hover:bg-stone-100 md:inline-flex">
            <LockKeyhole className="h-6 w-6" aria-hidden />
          </Link>
          <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} aria-label="Abrir menú" className="rounded-full p-2 text-nv-texto hover:bg-stone-100 md:hidden">
            {abierto ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
          </button>
        </div>
        <nav aria-label="Negocios Verdes" className={`${abierto ? "flex" : "hidden"} mt-1 flex-col pb-2 md:flex md:flex-row md:flex-wrap md:pb-0`}>
          {MENU_NV.map(([href, texto]) => {
            const a = activo(href);
            return (
              <Link
                key={href}
                prefetch={false}
                href={href}
                onClick={() => setAbierto(false)}
                aria-current={a ? "page" : undefined}
                className={`mb-1.5 mr-1 rounded-[6px] px-3.5 py-2 text-[13px] text-nv-texto transition-colors ${a ? "bg-nv-menu font-semibold" : "hover:bg-nv-claro"}`}
              >
                {texto}
              </Link>
            );
          })}
          <Link prefetch={false} href="/negocios-verdes/admin" className="mb-1.5 inline-flex items-center gap-2 rounded-[6px] px-3.5 py-2 text-[13px] text-nv-texto2 hover:bg-nv-claro md:hidden">
            <LockKeyhole className="h-4 w-4" aria-hidden /> Acceso administrativo
          </Link>
        </nav>
      </div>
      <div className="h-[3px] bg-nv-menu" />
    </header>
  );
}
