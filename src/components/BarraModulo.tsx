"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ExternalLink, Lock, type LucideIcon } from "lucide-react";

export type ItemMenu = {
  href: string;
  label: string;
  prefijo?: boolean;
  externo?: boolean;
  separador?: boolean;
  bloqueadoPara?: string;
  insignia?: { valor: number; alerta: boolean; titulo: string };
};

export type GrupoMenu = {
  label: string;
  icon: LucideIcon;
  href?: string;
  items?: ItemMenu[];
  lado?: "izquierda" | "derecha";
  bloqueadoPara?: string;
  insignia?: { valor: number; alerta: boolean; titulo: string };
};

export function BarraModulo({
  grupos,
  ariaLabel,
  esItemActivo,
}: {
  grupos: GrupoMenu[];
  ariaLabel: string;
  esItemActivo?: (item: ItemMenu, pathname: string) => boolean;
}) {
  const pathname = usePathname();
  const rutaDe = (href: string) => href.split("?")[0]!;

  const itemActivo = (it: ItemMenu) => {
    if (it.bloqueadoPara) return false;
    if (it.href.includes("?")) return false;
    if (esItemActivo) return esItemActivo(it, pathname);
    const ruta = rutaDe(it.href);
    return it.prefijo ? pathname === ruta || pathname.startsWith(ruta + "/") : pathname === ruta;
  };

  const grupoActivo = (g: GrupoMenu) => {
    if (g.bloqueadoPara) return false;
    if (g.href) {
      const ruta = rutaDe(g.href);
      return pathname === ruta || pathname.startsWith(ruta + "/");
    }
    return (g.items ?? []).some(itemActivo);
  };

  const bloque = (lado: "izquierda" | "derecha") =>
    grupos
      .filter((g) => (g.lado ?? "izquierda") === lado)
      .map((g) =>
        g.href ? (
          <EnlaceSimple key={g.label} grupo={g} activo={grupoActivo(g)} />
        ) : (
          <MenuGrupo key={g.label} grupo={g} activo={grupoActivo(g)} itemActivo={itemActivo} />
        )
      );

  const izquierda = bloque("izquierda");
  const derecha = bloque("derecha");

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50/80 p-1" aria-label={ariaLabel}>
      <div className="flex flex-wrap items-center gap-1">{izquierda}</div>
      {derecha.length > 0 && <div className="flex flex-wrap items-center gap-1">{derecha}</div>}
    </nav>
  );
}

function claseTab(activo: boolean, bloqueado = false) {
  if (bloqueado) return "flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-400";
  return `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    activo ? "bg-white text-cdmb-800 shadow-sm ring-1 ring-stone-200" : "text-stone-500 hover:bg-white/70 hover:text-stone-800"
  }`;
}

function Insignia({ insignia }: { insignia: NonNullable<GrupoMenu["insignia"]> }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white ${insignia.alerta ? "bg-red-600" : "bg-stone-400"}`}
      title={insignia.titulo}
      aria-label={insignia.titulo}
    >
      {insignia.valor}
    </span>
  );
}

function EnlaceSimple({ grupo, activo }: { grupo: GrupoMenu; activo: boolean }) {
  const Icon = grupo.icon;
  if (grupo.bloqueadoPara) {
    return (
      <span aria-disabled="true" title={grupo.bloqueadoPara} className={claseTab(false, true)}>
        <Icon className="h-4 w-4 text-stone-300" aria-hidden />
        {grupo.label}
        <Lock className="h-3 w-3 text-stone-300" aria-hidden />
        <span className="sr-only">{grupo.bloqueadoPara}</span>
      </span>
    );
  }
  return (
    <Link href={grupo.href!} aria-current={activo ? "page" : undefined} className={claseTab(activo)}>
      <Icon className={`h-4 w-4 ${activo ? "text-cdmb-600" : "text-stone-400"}`} aria-hidden />
      {grupo.label}
      {grupo.insignia && grupo.insignia.valor > 0 && <Insignia insignia={grupo.insignia} />}
    </Link>
  );
}

function MenuGrupo({ grupo, activo, itemActivo }: { grupo: GrupoMenu; activo: boolean; itemActivo: (it: ItemMenu) => boolean }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const pathname = usePathname();
  const Icon = grupo.icon;
  const items = grupo.items ?? [];
  const todoBloqueado = Boolean(grupo.bloqueadoPara) || (items.length > 0 && items.every((it) => it.bloqueadoPara));

  useEffect(() => setAbierto(false), [pathname]);

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
        className={`${claseTab(activo)} ${todoBloqueado ? "!text-stone-400" : ""}`}
      >
        <Icon className={`h-4 w-4 ${activo ? "text-cdmb-600" : todoBloqueado ? "text-stone-300" : "text-stone-400"}`} aria-hidden />
        {grupo.label}
        {grupo.insignia && grupo.insignia.valor > 0 && <Insignia insignia={grupo.insignia} />}
        {todoBloqueado && <Lock className="h-3 w-3 text-stone-300" aria-hidden />}
        <ChevronDown className={`h-3.5 w-3.5 text-stone-400 transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {abierto && (
        <div
          id={menuId}
          role="menu"
          aria-label={grupo.label}
          className="absolute right-0 top-full z-20 mt-2 min-w-[16rem] rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 sm:left-0 sm:right-auto"
        >
          {items.map((it) => {
            const leyenda = it.bloqueadoPara ?? grupo.bloqueadoPara;
            const divisor = it.separador && <div key={`${it.href}-sep`} role="separator" className="my-1 border-t border-stone-100" />;
            if (leyenda) {
              return (
                <div key={it.href}>
                  {divisor}
                  <span
                    role="menuitem"
                    aria-disabled="true"
                    title={leyenda}
                    className="flex cursor-not-allowed items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-stone-400"
                  >
                    <span>
                      {it.label}
                      <span className="block text-[10px] font-medium uppercase tracking-wide text-stone-300">{leyenda}</span>
                    </span>
                    <Lock className="h-3.5 w-3.5 flex-none text-stone-300" aria-hidden />
                  </span>
                </div>
              );
            }
            const act = itemActivo(it);
            return (
              <div key={it.href}>
                {divisor}
                <Link
                  href={it.href}
                  role="menuitem"
                  aria-current={act ? "page" : undefined}
                  className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    act ? "bg-cdmb-50 font-medium text-cdmb-800" : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                  }`}
                >
                  {it.label}
                  {it.insignia && it.insignia.valor > 0 && <Insignia insignia={it.insignia} />}
                  {it.externo && <ExternalLink className="h-3.5 w-3.5 flex-none text-stone-300" aria-hidden />}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
