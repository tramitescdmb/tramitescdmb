"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUser, ExternalLink, Globe, History, LayoutDashboard, LayoutGrid, Leaf, LogOut, Menu, Palette, Shapes, Store, Tag, Users, Contact, X } from "lucide-react";

type Opcion = { href: string; texto: string; icono: typeof Store; ver: boolean };

/** Títulos de la barra superior (los mismos de la plataforma anterior). */
function tituloDe(ruta: string): string {
  const t: [string, string][] = [
    ["/negocios-verdes/admin/negocios/nuevo", "Nuevo negocio"],
    ["/negocios-verdes/admin/negocios/", "Editar negocio"],
    ["/negocios-verdes/admin/negocios", "Negocios"],
    ["/negocios-verdes/admin/personas", "Personas"],
    ["/negocios-verdes/admin/categorias", "Categorías"],
    ["/negocios-verdes/admin/subcategorias", "Subcategorías"],
    ["/negocios-verdes/admin/actividades", "Actividades productivas"],
    ["/negocios-verdes/admin/apariencia", "Apariencia"],
    ["/negocios-verdes/admin/usuarios", "Usuarios"],
    ["/negocios-verdes/admin/auditoria", "Auditoría"],
    ["/negocios-verdes/admin/cuenta", "Mi cuenta"],
    ["/negocios-verdes/admin/revision", "Revisión de datos"],
    ["/negocios-verdes/admin/csv", "Importar / exportar"],
  ];
  return t.find(([p]) => ruta.startsWith(p))?.[1] ?? "Panel";
}

/**
 * Marco del administrador de Negocios Verdes con el menú lateral verde oscuro de la plataforma
 * anterior (mismas opciones y mismo orden). Cada opción se puede abrir también en otra pestaña.
 */
export function ShellAdminNV({ configurar, logoUrl, children }: { configurar: boolean; logoUrl: string; children: React.ReactNode }) {
  const ruta = usePathname() ?? "";
  const [abierto, setAbierto] = useState(false);
  const opciones: Opcion[] = [
    { href: "/negocios-verdes/admin", texto: "Panel", icono: LayoutDashboard, ver: true },
    { href: "/negocios-verdes/admin/negocios", texto: "Negocios", icono: Store, ver: true },
    { href: "/negocios-verdes/admin/personas", texto: "Personas", icono: Contact, ver: true },
    { href: "/negocios-verdes/admin/categorias", texto: "Categorías", icono: Shapes, ver: configurar },
    { href: "/negocios-verdes/admin/subcategorias", texto: "Subcategorías", icono: Tag, ver: configurar },
    { href: "/negocios-verdes/admin/actividades", texto: "Actividades productivas", icono: Leaf, ver: configurar },
    { href: "/negocios-verdes/admin/apariencia", texto: "Apariencia", icono: Palette, ver: configurar },
    { href: "/negocios-verdes/admin/usuarios", texto: "Usuarios", icono: Users, ver: configurar },
    { href: "/negocios-verdes/admin/auditoria", texto: "Auditoría", icono: History, ver: true },
    { href: "/negocios-verdes/admin/cuenta", texto: "Mi cuenta", icono: CircleUser, ver: true },
  ];
  const activa = (href: string) => (href === "/negocios-verdes/admin" ? ruta === href : ruta === href || ruta.startsWith(`${href}/`));
  const item = "flex min-h-[44px] items-center gap-3 rounded-[12px] px-3.5 py-2 text-[13.5px] tracking-[0.01em]";

  const menu = (
    <nav aria-label="Administrador de Negocios Verdes" className="flex h-full flex-col">
      <Link prefetch={false} href="/negocios-verdes/admin" className="flex items-center gap-2.5 px-5 pb-4 pt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" className="h-8 w-auto" />
        <span className="text-[15px] font-bold leading-tight text-white">
          Negocios Verdes
          <br />
          CDMB
        </span>
      </Link>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {opciones
          .filter((o) => o.ver)
          .map(({ href, texto, icono: Icono }) => {
            const a = activa(href);
            return (
              <li key={href} className="group relative">
                <Link prefetch={false} href={href} onClick={() => setAbierto(false)} aria-current={a ? "page" : undefined} className={`${item} pr-10 ${a ? "bg-nv-menu text-nv-texto" : "text-white/95 hover:bg-white/10"}`}>
                  <Icono className="h-5 w-5 flex-none" aria-hidden />
                  {texto}
                </Link>
                {!a && (
                  <a href={href} target="_blank" rel="noopener" title={`Abrir «${texto}» en otra pestaña`} aria-label={`Abrir ${texto} en otra pestaña`} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-white/60 hover:text-white">
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                )}
              </li>
            );
          })}
      </ul>
      <div className="space-y-0.5 border-t border-white/15 px-3 py-3">
        <a href="/negocios-verdes" target="_blank" rel="noopener" className={`${item} text-white/95 hover:bg-white/10`}>
          <Globe className="h-5 w-5" aria-hidden /> <span className="flex-1">Ver sitio público</span> <ExternalLink className="h-4 w-4 text-white/60" aria-hidden />
        </a>
        <Link prefetch={false} href="/dashboard" className={`${item} text-white/95 hover:bg-white/10`}>
          <LayoutGrid className="h-5 w-5" aria-hidden /> Volver al SIC
        </Link>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className={`${item} w-full text-white/95 hover:bg-white/10`}>
            <LogOut className="h-5 w-5" aria-hidden /> Cerrar sesión
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-[calc(100dvh-32px)] flex-1 bg-nv-fondo font-nv text-nv-texto">
      {/* La franja GOV.CO (28 px en escritorio) queda encima: el menú mide eso menos para que el pie no se corte. */}
      <aside className="hidden w-60 flex-none bg-nv-oscuro lg:block">
        <div className="sticky top-0 h-[calc(100dvh-28px)]">{menu}</div>
      </aside>
      {abierto && (
        <div className="fixed inset-0 z-[1500] flex lg:hidden">
          <aside className="h-full w-64 bg-nv-oscuro">{menu}</aside>
          <button type="button" aria-label="Cerrar menú" onClick={() => setAbierto(false)} className="flex-1 bg-black/40" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[1100] flex h-[58px] items-center gap-2 bg-white px-6">
          <button type="button" onClick={() => setAbierto(true)} aria-label="Abrir menú" className="-ml-2 rounded-full p-2 lg:hidden">
            {abierto ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
          <h1 className="text-lg font-medium">{tituloDe(ruta)}</h1>
        </header>
        <main className="flex-1 px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
