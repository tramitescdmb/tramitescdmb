"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";

const CLAVE_COLAPSADO = "sidebar-colapsado";

export function Sidebar({
  logoUrl,
  esAdmin,
  mostrarTramites,
  mostrarVital,
  mostrarSinca,
  mostrarCorrespondencia,
  mostrarContratacion,
  nombre,
  subtitulo,
  iniciales,
}: {
  logoUrl: string | null;
  esAdmin: boolean;
  mostrarTramites: boolean;
  mostrarVital: boolean;
  mostrarSinca: boolean;
  mostrarCorrespondencia: boolean;
  mostrarContratacion: boolean;
  nombre: string;
  subtitulo: string;
  iniciales: string;
}) {
  const [colapsado, setColapsado] = useState(false);
  const pathname = usePathname();

  // El geovisor necesita todo el ancho posible para el mapa: entrar a esa ruta
  // colapsa el menú aunque la preferencia guardada sea "expandido". Al salir se
  // respeta de nuevo la preferencia del usuario.
  useEffect(() => {
    if (pathname?.startsWith("/geovisor")) {
      setColapsado(true);
      return;
    }
    try {
      setColapsado(window.localStorage.getItem(CLAVE_COLAPSADO) === "1");
    } catch {}
  }, [pathname]);

  function alternar() {
    setColapsado((actual) => {
      const next = !actual;
      try {
        window.localStorage.setItem(CLAVE_COLAPSADO, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  return (
    <aside
      className={`sticky top-0 hidden h-screen flex-none flex-col border-r border-cdmb-800 bg-cdmb-700 text-white transition-[width] duration-200 lg:flex ${
        colapsado ? "w-20" : "w-64"
      }`}
    >
      <div className={`flex items-center border-b border-white/10 py-4 ${colapsado ? "justify-center px-2" : "justify-between px-4"}`}>
        <Link prefetch={false}
          href="/"
          className="flex min-w-0 items-center gap-2.5 font-semibold text-white"
          title={colapsado ? "Trámites CDMB" : undefined}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="CDMB" className="h-9 w-auto flex-none rounded-md bg-white p-0.5" />
          ) : (
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white text-sm font-bold text-cdmb-700">
              C
            </span>
          )}
          {!colapsado && <span className="truncate">Trámites CDMB</span>}
        </Link>
        {!colapsado && (
          <button
            type="button"
            onClick={alternar}
            aria-label="Colapsar menú"
            title="Colapsar menú"
            className="flex-none rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <PanelLeftClose className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {colapsado && (
        <div className="flex justify-center border-b border-white/10 py-2">
          <button
            type="button"
            onClick={alternar}
            aria-label="Expandir menú"
            title="Expandir menú"
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <PanelLeftOpen className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      <SidebarNav
        esAdmin={esAdmin}
        mostrarTramites={mostrarTramites}
        mostrarVital={mostrarVital}
        mostrarSinca={mostrarSinca}
        mostrarCorrespondencia={mostrarCorrespondencia}
        mostrarContratacion={mostrarContratacion}
        colapsado={colapsado}
      />

      <div className="border-t border-white/10 p-3">
        <Link prefetch={false}
          href="/mi-cuenta"
          title={colapsado ? nombre : undefined}
          className={
            colapsado
              ? "flex items-center justify-center rounded-xl py-2 transition-colors hover:bg-white/10"
              : "flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-white/10"
          }
        >
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-menu-500 text-xs font-semibold text-stone-900">
            {iniciales}
          </span>
          {!colapsado && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{nombre}</p>
              <p className="truncate text-xs text-white/60">{subtitulo}</p>
            </div>
          )}
        </Link>
        <form action="/api/auth/logout" method="post" className={colapsado ? "mt-1.5 flex justify-center" : "mt-1.5 px-2"}>
          <button
            title={colapsado ? "Salir" : undefined}
            className={
              colapsado
                ? "flex items-center justify-center rounded-lg border border-white/25 p-2 text-white/80 transition-transform hover:bg-white/10 active:scale-95"
                : "flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-1.5 text-xs font-medium text-white/80 transition-transform hover:bg-white/10 active:scale-95"
            }
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            {!colapsado && "Salir"}
          </button>
        </form>
      </div>
    </aside>
  );
}
