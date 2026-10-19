"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChevronDown, IconLock, IconExternalLink } from "@tabler/icons-react";
import { actividadMenu, type GrupoMenu, type ItemMenu } from "@/components/BarraModulo";
import type { MenuPublicado } from "@/components/MenuModulo";

type Insignia = NonNullable<GrupoMenu["insignia"]>;

function Contador({ insignia }: { insignia: Insignia }) {
  if (insignia.valor <= 0) return null;
  return (
    <span
      title={insignia.titulo}
      aria-label={insignia.titulo}
      className={`ml-auto rounded-sm px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums ${insignia.alerta ? "bg-red-500 text-white" : "bg-white/20 text-white"}`}
    >
      {insignia.valor}
    </span>
  );
}

const FILA = "flex w-full items-center gap-2.5 py-2 pr-4 text-[13.5px] transition-colors";

function claseFila(activo: boolean) {
  return `${FILA} ${activo ? "bg-black/25 font-semibold text-white" : "text-white/75 hover:bg-white/5 hover:text-white"}`;
}

function Bloqueado({ label, motivo, sangria }: { label: string; motivo: string; sangria: string }) {
  return (
    <span aria-disabled="true" title={motivo} className={`${FILA} ${sangria} cursor-not-allowed text-white/35`}>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <IconLock className="h-3.5 w-3.5 flex-none" stroke={1.75} aria-hidden />
      <span className="sr-only">{motivo}</span>
    </span>
  );
}

function Subgrupo({ grupo, activo, itemActivo }: { grupo: GrupoMenu; activo: boolean; itemActivo: (it: ItemMenu) => boolean }) {
  const [abierto, setAbierto] = useState(activo);
  const pathname = usePathname();
  useEffect(() => {
    if (activo) setAbierto(true);
  }, [activo, pathname]);
  const Icon = grupo.icon;
  const items = grupo.items ?? [];

  return (
    <li>
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)} className={`${claseFila(false)} pl-9 ${activo ? "!text-white" : ""}`}>
        <Icon className="h-4 w-4 flex-none" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">{grupo.label}</span>
        {grupo.insignia && <Contador insignia={grupo.insignia} />}
        <IconChevronDown className={`h-4 w-4 flex-none opacity-70 transition-transform ${abierto ? "" : "-rotate-90"}`} stroke={1.75} aria-hidden />
      </button>
      {abierto && (
        <ul>
          {items.map((it) => {
            const motivo = it.bloqueadoPara ?? grupo.bloqueadoPara;
            if (motivo) {
              return (
                <li key={it.href}>
                  <Bloqueado label={it.label} motivo={motivo} sangria="pl-[3.75rem]" />
                </li>
              );
            }
            const act = itemActivo(it);
            return (
              <li key={it.href}>
                <Link prefetch={false} href={it.href} aria-current={act ? "page" : undefined} className={`${claseFila(act)} pl-[3.75rem]`}>
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {it.insignia && <Contador insignia={it.insignia} />}
                  {it.externo && <IconExternalLink className="h-3.5 w-3.5 flex-none opacity-60" stroke={1.75} aria-hidden />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function SubmenuModulo({ menu }: { menu: MenuPublicado }) {
  const pathname = usePathname() ?? "";
  const { itemActivo, grupoActivo } = actividadMenu(pathname, menu.esItemActivo);
  const ordenados = [...menu.grupos.filter((g) => g.lado !== "derecha"), ...menu.grupos.filter((g) => g.lado === "derecha")];

  return (
    <ul className="bg-black/10 py-1">
      {ordenados.map((g) => {
        if (g.items) return <Subgrupo key={g.label} grupo={g} activo={grupoActivo(g)} itemActivo={itemActivo} />;
        if (g.bloqueadoPara) {
          return (
            <li key={g.label}>
              <Bloqueado label={g.label} motivo={g.bloqueadoPara} sangria="pl-9" />
            </li>
          );
        }
        const Icon = g.icon;
        const act = grupoActivo(g);
        return (
          <li key={g.label}>
            <Link prefetch={false} href={g.href!} aria-current={act ? "page" : undefined} className={`${claseFila(act)} pl-9`}>
              <Icon className="h-4 w-4 flex-none" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{g.label}</span>
              {g.insignia && <Contador insignia={g.insignia} />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
