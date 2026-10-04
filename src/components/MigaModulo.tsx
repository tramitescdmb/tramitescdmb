"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

export type RutaMiga = { re: RegExp; trail: string[] };

export function MigaModulo({
  inicio,
  inicioGrupo,
  rutas,
}: {
  inicio: { label: string; href: string };
  inicioGrupo: Record<string, string>;
  rutas: RutaMiga[];
}) {
  const pathname = usePathname();
  const trail = rutas.find((r) => r.re.test(pathname))?.trail ?? [];

  return (
    <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5 text-xs text-stone-400">
      <Link prefetch={false} href={inicio.href} className="flex items-center gap-1 hover:text-cdmb-700">
        <Home className="h-3.5 w-3.5" aria-hidden />
        {inicio.label}
      </Link>
      {trail.map((paso, i) => {
        const ultimo = i === trail.length - 1;
        const href = i === 0 ? inicioGrupo[paso] : undefined;
        return (
          <Fragment key={`${paso}-${i}`}>
            <ChevronRight className="h-3.5 w-3.5 flex-none text-stone-300" aria-hidden />
            {ultimo ? (
              <span className="font-medium text-stone-600" aria-current="page">
                {paso}
              </span>
            ) : href ? (
              <Link prefetch={false} href={href} className="hover:text-cdmb-700">
                {paso}
              </Link>
            ) : (
              <span>{paso}</span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
