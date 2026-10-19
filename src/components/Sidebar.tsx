"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChevronsLeft, IconChevronsRight } from "@tabler/icons-react";
import { SidebarNav } from "@/components/SidebarNav";

export function Sidebar({
  logoUrl,
  esAdmin,
  mostrarTramites,
  mostrarVital,
  mostrarSinca,
  mostrarCorrespondencia,
  mostrarContratacion,
}: {
  logoUrl: string | null;
  esAdmin: boolean;
  mostrarTramites: boolean;
  mostrarVital: boolean;
  mostrarSinca: boolean;
  mostrarCorrespondencia: boolean;
  mostrarContratacion: boolean;
}) {
  const [colapsado, setColapsado] = useState(true);
  const pathname = usePathname();
  const modulo = pathname?.split("/")[1] ?? "";

  useEffect(() => {
    setColapsado(true);
  }, [modulo]);

  return (
    <aside
      className={`sticky top-0 hidden h-[calc(100vh-2rem)] max-h-screen flex-none flex-col bg-cdmb-800 text-white transition-[width] duration-200 lg:flex ${
        colapsado ? "w-16" : "w-64"
      }`}
    >
      <Link prefetch={false}
        href="/"
        className={`flex h-14 flex-none items-center gap-2.5 border-b border-black/20 bg-cdmb-900 font-semibold text-white ${
          colapsado ? "justify-center px-2" : "px-5"
        }`}
        title={colapsado ? "Trámites CDMB" : undefined}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="CDMB" className="h-8 w-auto flex-none rounded bg-white p-0.5" />
        ) : (
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded bg-white text-sm font-bold text-cdmb-700">C</span>
        )}
        {!colapsado && <span className="truncate text-[15px]">Trámites CDMB</span>}
      </Link>

      <SidebarNav
        esAdmin={esAdmin}
        mostrarTramites={mostrarTramites}
        mostrarVital={mostrarVital}
        mostrarSinca={mostrarSinca}
        mostrarCorrespondencia={mostrarCorrespondencia}
        mostrarContratacion={mostrarContratacion}
        colapsado={colapsado}
      />

      <button
        type="button"
        onClick={() => setColapsado((actual) => !actual)}
        aria-label={colapsado ? "Expandir menú" : "Contraer menú"}
        title={colapsado ? "Expandir menú" : undefined}
        className={`flex flex-none items-center gap-2 border-t border-black/20 py-3 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white ${
          colapsado ? "justify-center" : "px-5"
        }`}
      >
        {colapsado ? <IconChevronsRight className="h-5 w-5" stroke={1.75} aria-hidden /> : <IconChevronsLeft className="h-5 w-5" stroke={1.75} aria-hidden />}
        {!colapsado && "Contraer menú"}
      </button>
    </aside>
  );
}
