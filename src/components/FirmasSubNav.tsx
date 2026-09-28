"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, FileSignature, FileX2 } from "lucide-react";
import { GloboPendientes } from "@/components/GloboPendientes";
import { SIN_PENDIENTES_FIRMA, type ResumenPendientesFirma } from "@/lib/calidad-firma";
import { RUTAS_FIRMAS_TRAMITES, type RutasFirmas } from "@/lib/rutas-firmas";

export function FirmasSubNav({
  pendientes = SIN_PENDIENTES_FIRMA,
  rechazosPorAtender = 0,
  rutas = RUTAS_FIRMAS_TRAMITES,
}: {
  pendientes?: ResumenPendientesFirma;
  rechazosPorAtender?: number;
  rutas?: RutasFirmas;
}) {
  const pathname = usePathname();
  const ITEMS = [
    { href: rutas.buzon, label: "Buzón de firmas", icon: Inbox },
    { href: rutas.misFirmas, label: "Mis firmas", icon: FileSignature },
    { href: rutas.rechazos, label: "Rechazos al firmar", icon: FileX2 },
  ];
  return (
    <nav className="flex flex-wrap items-center gap-1.5" aria-label="Firmas">
      {ITEMS.map((item) => {
        const activo = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={activo ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              activo ? "bg-cdmb-50 text-cdmb-800" : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {item.label}
            {item.href === rutas.buzon && pendientes.total > 0 && <GloboPendientes pendientes={pendientes} />}
            {item.href === rutas.rechazos && rechazosPorAtender > 0 && (
              <span
                className="rounded-full bg-red-600 px-1.5 text-[10px] font-semibold leading-4 text-white"
                title={`${rechazosPorAtender} rechazo${rechazosPorAtender === 1 ? "" : "s"} por atender`}
              >
                {rechazosPorAtender}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
