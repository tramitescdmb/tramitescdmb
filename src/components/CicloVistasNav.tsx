"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export type NodoCiclo = { href: string; label: string; desc: string; icon: LucideIcon; insignia?: number };

export function CicloVistasNav({ nodos, rutaRaiz, ariaLabel }: { nodos: NodoCiclo[]; rutaRaiz: string; ariaLabel: string }) {
  const pathname = usePathname();
  const esActivo = (href: string) => (href === rutaRaiz ? pathname === href : pathname.startsWith(href));

  return (
    <nav aria-label={ariaLabel} className="rounded-xl border border-stone-200 bg-white px-3 py-4 shadow-soft sm:px-6">
      <div className="overflow-x-auto overflow-y-hidden">
        <ol className="flex min-w-[34rem] items-start justify-between gap-1 py-1">
          {nodos.map((nodo, i) => {
            const activo = esActivo(nodo.href);
            const Icon = nodo.icon;
            return (
              <Fragment key={nodo.href}>
                {i > 0 && <li aria-hidden className="mt-6 h-0 min-w-8 flex-1 border-t-2 border-dashed border-stone-200" />}
                <li className="flex w-32 flex-none flex-col items-center text-center sm:w-36">
                  <Link href={nodo.href} aria-current={activo ? "page" : undefined} className="group flex flex-col items-center outline-none">
                    <span className="relative">
                      <span
                        className={`flex h-12 w-12 flex-none items-center justify-center rounded-full transition ${
                          activo
                            ? "bg-cdmb-600 text-white shadow-sm ring-4 ring-cdmb-100"
                            : "border-2 border-stone-200 bg-white text-stone-400 group-hover:border-cdmb-400 group-hover:text-cdmb-600 group-focus-visible:border-cdmb-400"
                        }`}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      {nodo.insignia !== undefined && nodo.insignia > 0 && (
                        <span className="absolute -right-1.5 -top-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                          {nodo.insignia}
                        </span>
                      )}
                    </span>
                    <span className={`mt-1 text-xs font-semibold leading-tight ${activo ? "text-cdmb-800" : "text-stone-500 group-hover:text-stone-800"}`}>
                      {nodo.label}
                    </span>
                    <span className="mt-0.5 hidden text-[11px] leading-tight text-stone-400 sm:block">{nodo.desc}</span>
                  </Link>
                </li>
              </Fragment>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
