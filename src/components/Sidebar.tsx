"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";

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
  const [colapsado, setColapsado] = useState(true);
  const pathname = usePathname();
  const modulo = pathname?.split("/")[1] ?? "";

  useEffect(() => {
    setColapsado(true);
  }, [modulo]);

  function alternar() {
    setColapsado((actual) => !actual);
  }

  return (
    <aside
      className={`sticky top-0 hidden h-[calc(100vh-2rem)] max-h-screen flex-none flex-col border-r border-cdmb-800 bg-cdmb-700 text-white transition-[width] duration-200 lg:flex ${
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

      <div className={`flex flex-none border-t border-white/10 p-2 ${colapsado ? "flex-col items-center gap-1" : "items-center gap-1"}`}>
        <Link prefetch={false}
          href="/mi-cuenta"
          title={colapsado ? `${nombre} · ${subtitulo}` : "Mi cuenta"}
          className={
            colapsado
              ? "flex items-center justify-center rounded-xl p-1.5 transition-colors hover:bg-white/10"
              : "flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/10"
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
        <form action="/api/auth/logout" method="post" className="flex-none">
          <button
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Salir
          </button>
        </form>
      </div>
    </aside>
  );
}
