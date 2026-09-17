"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";

const CLAVE_COLAPSADO = "sidebar-colapsado";

/**
 * Sidebar de escritorio con colapso manual a una franja de solo íconos —
 * comodidad de cada quien (localStorage, como en useAnchosColumna), no se
 * sincroniza entre dispositivos ni usuarios. Vive en el layout raíz, que no
 * se remonta entre rutas, así que el estado ya sobrevive la navegación por
 * sí solo; localStorage es solo para que sobreviva un recargo de página.
 */
export function Sidebar({
  logoUrl,
  esAdmin,
  mostrarVital,
  mostrarSinca,
  mostrarCorrespondencia,
  nombre,
  subtitulo,
  iniciales,
}: {
  logoUrl: string | null;
  esAdmin: boolean;
  mostrarVital: boolean;
  mostrarSinca: boolean;
  mostrarCorrespondencia: boolean;
  nombre: string;
  subtitulo: string;
  iniciales: string;
}) {
  const [colapsado, setColapsado] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(CLAVE_COLAPSADO) === "1") setColapsado(true);
    } catch {
      // localStorage puede fallar (modo privado, cuota agotada) — se queda expandido.
    }
  }, []);

  function alternar() {
    setColapsado((actual) => {
      const next = !actual;
      try {
        window.localStorage.setItem(CLAVE_COLAPSADO, next ? "1" : "0");
      } catch {
        // idem
      }
      return next;
    });
  }

  return (
    <aside
      className={`sticky top-0 hidden h-screen flex-none flex-col border-r border-graphite-100 bg-white transition-[width] duration-200 lg:flex ${
        colapsado ? "w-20" : "w-64"
      }`}
    >
      <div className={`flex items-center border-b border-graphite-100 py-4 ${colapsado ? "justify-center px-2" : "justify-between px-4"}`}>
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 font-semibold text-graphite-900"
          title={colapsado ? "Trámites CDMB" : undefined}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="CDMB" className="h-8 w-auto flex-none" />
          ) : (
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-cdmb-600 text-sm font-bold text-white">
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
            className="flex-none rounded-lg p-1.5 text-graphite-400 hover:bg-graphite-50 hover:text-graphite-700"
          >
            <PanelLeftClose className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {colapsado && (
        <div className="flex justify-center border-b border-graphite-100 py-2">
          <button
            type="button"
            onClick={alternar}
            aria-label="Expandir menú"
            title="Expandir menú"
            className="rounded-lg p-1.5 text-graphite-400 hover:bg-graphite-50 hover:text-graphite-700"
          >
            <PanelLeftOpen className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      <SidebarNav
        esAdmin={esAdmin}
        mostrarVital={mostrarVital}
        mostrarSinca={mostrarSinca}
        mostrarCorrespondencia={mostrarCorrespondencia}
        colapsado={colapsado}
      />

      <div className="border-t border-graphite-100 p-3">
        <Link
          href="/mi-cuenta"
          title={colapsado ? nombre : undefined}
          className={
            colapsado
              ? "flex items-center justify-center rounded-xl py-2 transition-colors hover:bg-graphite-50"
              : "flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-graphite-50"
          }
        >
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-cdmb-100 text-xs font-semibold text-cdmb-800">
            {iniciales}
          </span>
          {!colapsado && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-graphite-800">{nombre}</p>
              <p className="truncate text-xs text-graphite-400">{subtitulo}</p>
            </div>
          )}
        </Link>
        <form action="/api/auth/logout" method="post" className={colapsado ? "mt-1.5 flex justify-center" : "mt-1.5 px-2"}>
          <button
            title={colapsado ? "Salir" : undefined}
            className={
              colapsado
                ? "flex items-center justify-center rounded-lg border border-graphite-200 p-2 text-graphite-600 transition-transform hover:bg-graphite-50 active:scale-95"
                : "flex items-center gap-1.5 rounded-lg border border-graphite-200 px-3 py-1.5 text-xs font-medium text-graphite-600 transition-transform hover:bg-graphite-50 active:scale-95"
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
