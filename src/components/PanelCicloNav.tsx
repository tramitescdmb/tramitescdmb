"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListChecks, Inbox, FolderOpen, ShieldAlert, type LucideIcon } from "lucide-react";

type Nodo = { href: string; label: string; desc: string; icon: LucideIcon; soloAdmin?: boolean };

const NODOS: Nodo[] = [
  { href: "/correspondencia/panel", label: "Mi trabajo pendiente", desc: "Lo asignado a usted", icon: ListChecks },
  { href: "/correspondencia/panel/correspondencia", label: "Correspondencia", desc: "Recibidas, enviadas y memorandos", icon: Inbox },
  { href: "/correspondencia/panel/archivo", label: "Expedientes y archivo", desc: "Expedientes, TRD y transferencias", icon: FolderOpen },
  { href: "/correspondencia/panel/sistema", label: "Sistema", desc: "Incidencias y bitácora", icon: ShieldAlert, soloAdmin: true },
];

/**
 * Navegación circular del tablero del SGDEA: un anillo por vista, unidos como un
 * ciclo (círculo · línea · círculo). Reemplaza el scroll largo de secciones —
 * cada anillo lleva a su propia ruta, y solo se carga la vista que se abre.
 */
export function PanelCicloNav({ esAdmin }: { esAdmin: boolean }) {
  const pathname = usePathname();
  const nodos = NODOS.filter((n) => !n.soloAdmin || esAdmin);

  const esActivo = (href: string) =>
    href === "/correspondencia/panel" ? pathname === href : pathname.startsWith(href);

  return (
    <nav
      aria-label="Vistas del tablero"
      className="rounded-xl border border-stone-200 bg-white px-3 py-4 sm:px-6"
    >
      <ol className="flex items-start justify-between gap-1 overflow-x-auto">
        {nodos.map((nodo, i) => {
          const activo = esActivo(nodo.href);
          const Icon = nodo.icon;
          return (
            <Fragment key={nodo.href}>
              {i > 0 && (
                <li
                  aria-hidden
                  className="mt-6 h-0 min-w-8 flex-1 border-t-2 border-dashed border-stone-200"
                />
              )}
              <li className="flex w-32 flex-none flex-col items-center text-center sm:w-36">
                <Link
                  href={nodo.href}
                  aria-current={activo ? "page" : undefined}
                  className="group flex flex-col items-center outline-none"
                >
                  <span
                    className={`flex h-12 w-12 flex-none items-center justify-center rounded-full transition ${
                      activo
                        ? "bg-cdmb-600 text-white shadow-sm ring-4 ring-cdmb-100"
                        : "border-2 border-stone-300 bg-white text-stone-400 group-hover:border-cdmb-400 group-hover:text-cdmb-600 group-focus-visible:border-cdmb-400"
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-stone-300">
                    {i + 1} / {nodos.length}
                  </span>
                  <span
                    className={`mt-0.5 text-xs font-semibold leading-tight ${
                      activo ? "text-cdmb-800" : "text-stone-500 group-hover:text-stone-800"
                    }`}
                  >
                    {nodo.label}
                  </span>
                  <span className="mt-0.5 hidden text-[11px] leading-tight text-stone-400 sm:block">
                    {nodo.desc}
                  </span>
                </Link>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
