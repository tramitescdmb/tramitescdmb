"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconMenu2 as Menu, IconX as X, IconLogout as LogOut } from "@tabler/icons-react";
import { SidebarNav } from "@/components/SidebarNav";
import { EncabezadoMenu } from "@/components/EncabezadoMenu";
import { SelectorColorMenu } from "@/components/SelectorColorMenu";

export function MobileNav({
  esAdmin,
  mostrarTramites,
  mostrarVital,
  mostrarSinca,
  mostrarCorrespondencia,
  mostrarContratacion,
  mostrarMemorandos = false,
  logoUrl = null,
  nombre,
  subtitulo,
  iniciales,
}: {
  esAdmin: boolean;
  mostrarTramites: boolean;
  mostrarVital: boolean;
  mostrarSinca: boolean;
  mostrarCorrespondencia: boolean;
  mostrarContratacion: boolean;
  mostrarMemorandos?: boolean;
  logoUrl?: string | null;
  nombre: string;
  subtitulo: string;
  iniciales: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir menú"
        aria-expanded={abierto}
        className="flex-none rounded-lg p-2 text-white hover:bg-white/10 lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
            className="absolute inset-0 bg-graphite-900/40 backdrop-blur-[2px]"
          />
          <div role="dialog" aria-modal="true" aria-label="Menú" className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-lateral text-white shadow-soft-lg">
            <div className="relative">
              <EncabezadoMenu logoUrl={logoUrl} />
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <SidebarNav
              esAdmin={esAdmin}
              mostrarTramites={mostrarTramites}
              mostrarVital={mostrarVital}
              mostrarSinca={mostrarSinca}
              mostrarCorrespondencia={mostrarCorrespondencia}
              mostrarContratacion={mostrarContratacion}
              mostrarMemorandos={mostrarMemorandos}
            />

            <div className="border-t border-white/10 bg-lateral-oscuro/60 p-3">
              <Link prefetch={false} href="/mi-cuenta" className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-white/10">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded bg-acento-500 text-xs font-semibold text-white">
                  {iniciales}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{nombre}</p>
                  <p className="truncate text-xs text-white/60">{subtitulo}</p>
                </div>
              </Link>
              <div className="mt-1.5 flex items-center gap-2 px-2">
              <form action="/api/auth/logout" method="post" className="flex-1">
                <button className="flex w-full items-center gap-1.5 rounded-lg border border-white/25 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 active:scale-95">
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  Salir
                </button>
              </form>
              <SelectorColorMenu />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
