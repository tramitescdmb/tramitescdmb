"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

function esRutaPublica(pathname: string) {
  return pathname === "/pqrsd" || pathname.startsWith("/pqrsd/") || pathname.startsWith("/verificar/") || pathname === "/validar-firma";
}

export function Cascaron({
  navBar,
  encabezadoPublico,
  pie,
  children,
}: {
  navBar: ReactNode;
  encabezadoPublico: ReactNode;
  pie: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";

  if (esRutaPublica(pathname)) {
    return (
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="print:hidden">{encabezadoPublico}</div>
        <main
          className={`mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:py-8 print:max-w-none print:p-0 ${
            pathname === "/validar-firma" ? "max-w-6xl" : "max-w-3xl"
          }`}
        >
          {children}
        </main>
        <div className="print:hidden">{pie}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <div className="print:hidden">{navBar}</div>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">{children}</main>
        <div className="print:hidden">{pie}</div>
      </div>
    </div>
  );
}
