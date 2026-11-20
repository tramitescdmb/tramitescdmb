"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, FilePlus2, FolderOpen, LayoutGrid, Leaf, MessageSquareText, Search, ShieldCheck, type LucideIcon } from "lucide-react";

type Enlace = { href: string; label: string; icono: LucideIcon; activo: (p: string) => boolean };
type Grupo = { label: string; icono: LucideIcon; opciones: Enlace[] };
type Opcion = Enlace | Grupo;

const esConsultaAmbiental = (p: string) => p.startsWith("/solicitud-ambiental/consultar");
const esCuentaAmbiental = (p: string) => p.startsWith("/solicitud-ambiental/mis-solicitudes") || p.startsWith("/solicitud-ambiental/ingresar");

const OPCIONES: Opcion[] = [
  { href: "/", label: "Aplicativos CDMB", icono: LayoutGrid, activo: (p) => p === "/" },
  {
    label: "PQRSD",
    icono: MessageSquareText,
    opciones: [
      { href: "/pqrsd", label: "Radicar PQRSD", icono: FilePlus2, activo: (p) => p === "/pqrsd" },
      { href: "/pqrsd/consultar", label: "Consultar PQRSD", icono: Search, activo: (p) => p.startsWith("/pqrsd/consultar") },
    ],
  },
  {
    label: "Solicitud ambiental",
    icono: Leaf,
    opciones: [
      { href: "/solicitud-ambiental", label: "Radicar solicitud ambiental", icono: FilePlus2, activo: (p) => p.startsWith("/solicitud-ambiental") && !esConsultaAmbiental(p) && !esCuentaAmbiental(p) },
      { href: "/solicitud-ambiental/consultar", label: "Consultar solicitud ambiental", icono: Search, activo: esConsultaAmbiental },
      { href: "/solicitud-ambiental/mis-solicitudes", label: "Mis solicitudes", icono: FolderOpen, activo: esCuentaAmbiental },
    ],
  },
  { href: "/validar-firma", label: "Validador de firmas", icono: ShieldCheck, activo: (p) => p.startsWith("/validar-firma") || p.startsWith("/verificar") },
];

const claseOpcion = (activo: boolean) =>
  `flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-stone-900 ${activo ? "bg-menu-500" : "hover:bg-menu-100"}`;

/** Menú desplegable (PQRSD, Solicitud ambiental): abre con clic o teclado, cierra con Escape, clic fuera o al navegar. */
function MenuGrupo({ grupo, pathname }: { grupo: Grupo; pathname: string }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const activo = grupo.opciones.some((o) => o.activo(pathname));
  const Icono = grupo.icono;

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  function teclado(e: React.KeyboardEvent<HTMLDivElement>) {
    const enlaces = Array.from(contenedor.current?.querySelectorAll<HTMLAnchorElement>("[role=menuitem]") ?? []);
    const i = enlaces.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "Escape" && abierto) {
      e.preventDefault();
      setAbierto(false);
      boton.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!abierto) {
        setAbierto(true);
        requestAnimationFrame(() => contenedor.current?.querySelector<HTMLAnchorElement>("[role=menuitem]")?.focus());
      } else enlaces[(i + 1) % enlaces.length]?.focus();
    } else if (e.key === "ArrowUp" && abierto) {
      e.preventDefault();
      enlaces[(i - 1 + enlaces.length) % enlaces.length]?.focus();
    }
  }

  return (
    <div
      ref={contenedor}
      className="relative"
      onKeyDown={teclado}
      onBlur={(e) => {
        if (!contenedor.current?.contains(e.relatedTarget as Node)) setAbierto(false);
      }}
    >
      <button
        ref={boton}
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className={claseOpcion(activo)}
      >
        <Icono className="h-4 w-4" aria-hidden />
        {grupo.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {abierto && (
        <div role="menu" aria-label={grupo.label} className="absolute left-0 z-40 mt-1 min-w-[15rem] rounded-md border border-stone-200 bg-white py-1 shadow-lg">
          {grupo.opciones.map((o) => {
            const Ic = o.icono;
            const act = o.activo(pathname);
            return (
              <Link
                key={o.href}
                role="menuitem"
                prefetch={false}
                href={o.href}
                aria-current={act ? "page" : undefined}
                onClick={() => setAbierto(false)}
                className={`flex items-center gap-2 px-3 py-2 text-sm text-stone-800 focus:bg-menu-100 focus:outline-none ${act ? "bg-menu-100 font-semibold" : "hover:bg-menu-100"}`}
              >
                <Ic className="h-4 w-4 flex-none" aria-hidden />
                {o.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MenuPublico() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Servicios en línea">
      {OPCIONES.map((o) => {
        if ("opciones" in o) return <MenuGrupo key={o.label} grupo={o} pathname={pathname} />;
        const activo = o.activo(pathname);
        const Icono = o.icono;
        return (
          <Link key={o.href} prefetch={false} href={o.href} aria-current={activo ? "page" : undefined} className={claseOpcion(activo)}>
            <Icono className="h-4 w-4" aria-hidden />
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
