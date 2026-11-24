"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PestanasPanelNV({ configurar, gestionar }: { configurar: boolean; gestionar: boolean }) {
  const pathname = usePathname() ?? "";
  const pestanas = [
    { href: "/negocios-verdes/admin", label: "Negocios", activa: pathname === "/negocios-verdes/admin" || pathname.startsWith("/negocios-verdes/admin/negocios") },
    { href: "/negocios-verdes/admin/personas", label: "Personas", activa: pathname.startsWith("/negocios-verdes/admin/personas") },
    { href: "/negocios-verdes/admin/revision", label: "Revisión de datos", activa: pathname.startsWith("/negocios-verdes/admin/revision") },
    { href: "/negocios-verdes/admin/csv", label: gestionar ? "Importar / exportar" : "Exportar", activa: pathname.startsWith("/negocios-verdes/admin/csv") },
    ...(configurar
      ? [
          { href: "/negocios-verdes/admin/clasificacion", label: "Clasificación", activa: pathname.startsWith("/negocios-verdes/admin/clasificacion") },
          { href: "/negocios-verdes/admin/apariencia", label: "Apariencia del sitio", activa: pathname.startsWith("/negocios-verdes/admin/apariencia") },
        ]
      : []),
  ];
  return (
    <nav aria-label="Secciones de Negocios Verdes" className="flex flex-wrap gap-1 border-b border-stone-200 text-sm">
      {pestanas.map((p) => (
        <Link
          key={p.href}
          prefetch={false}
          href={p.href}
          aria-current={p.activa ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 font-medium ${p.activa ? "border-emerald-600 text-emerald-800" : "border-transparent text-stone-600 hover:text-stone-900"}`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
