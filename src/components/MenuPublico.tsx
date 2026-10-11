"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, FilePlus2, Search, ShieldCheck } from "lucide-react";

const OPCIONES = [
  { href: "/", label: "Aplicativos CDMB", icono: LayoutGrid, activo: (p: string) => p === "/" },
  { href: "/pqrsd", label: "Radicar PQRSD", icono: FilePlus2, activo: (p: string) => p === "/pqrsd" },
  { href: "/pqrsd/consultar", label: "Consultar estado", icono: Search, activo: (p: string) => p.startsWith("/pqrsd/consultar") },
  { href: "/validar-firma", label: "Validador de firmas", icono: ShieldCheck, activo: (p: string) => p.startsWith("/validar-firma") || p.startsWith("/verificar") },
];

export function MenuPublico() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Servicios en línea">
      {OPCIONES.map((o) => {
        const activo = o.activo(pathname);
        const Icono = o.icono;
        return (
          <Link
            key={o.href}
            prefetch={false}
            href={o.href}
            aria-current={activo ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-stone-900 ${activo ? "bg-menu-500" : "hover:bg-menu-100"}`}
          >
            <Icono className="h-4 w-4" aria-hidden />
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
