"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";

/**
 * Menú de pantallas chicas: antes era una barra horizontal con toda la
 * navegación en una fila, que en un celular normal se corta a los dos o tres
 * ítems (ej. "Correspondencia y...") y obliga a deslizar para ver el resto.
 * Ahora es un botón hamburguesa que abre el MISMO menú vertical del sidebar
 * de escritorio como un panel lateral (izquierda), dejando la barra superior
 * con solo la marca y este botón — el patrón de apps como X/Twitter.
 */
export function MobileNav({
  esAdmin,
  mostrarVital,
  mostrarSinca,
  mostrarCorrespondencia,
  mostrarContratacion,
  nombre,
  subtitulo,
  iniciales,
}: {
  esAdmin: boolean;
  mostrarVital: boolean;
  mostrarSinca: boolean;
  mostrarCorrespondencia: boolean;
  mostrarContratacion: boolean;
  nombre: string;
  subtitulo: string;
  iniciales: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();

  // Navegar a un enlace del menú debe cerrarlo — el layout persiste entre
  // rutas (no se desmonta), así que sin esto el panel quedaría abierto.
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
        className="flex-none rounded-lg p-2 text-graphite-600 hover:bg-graphite-100 lg:hidden"
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
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-soft-lg">
            <div className="flex items-center justify-between border-b border-graphite-100 px-4 py-4">
              <span className="font-semibold text-graphite-900">Menú</span>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                className="rounded-lg p-1.5 text-graphite-500 hover:bg-graphite-100"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <SidebarNav
              esAdmin={esAdmin}
              mostrarVital={mostrarVital}
              mostrarSinca={mostrarSinca}
              mostrarCorrespondencia={mostrarCorrespondencia}
              mostrarContratacion={mostrarContratacion}
            />

            <div className="border-t border-graphite-100 p-3">
              <Link href="/mi-cuenta" className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-graphite-50">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-cdmb-100 text-xs font-semibold text-cdmb-800">
                  {iniciales}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-graphite-800">{nombre}</p>
                  <p className="truncate text-xs text-graphite-400">{subtitulo}</p>
                </div>
              </Link>
              <form action="/api/auth/logout" method="post" className="mt-1.5 px-2">
                <button className="flex w-full items-center gap-1.5 rounded-lg border border-graphite-200 px-3 py-1.5 text-xs font-medium text-graphite-600 hover:bg-graphite-50 active:scale-95">
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  Salir
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
