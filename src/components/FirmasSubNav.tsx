"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, FileSignature } from "lucide-react";

const ITEMS = [
  { href: "/firmas/buzon", label: "Buzón de firmas", icon: Inbox },
  { href: "/firmas/mis-firmas", label: "Mis firmas", icon: FileSignature },
];

export function FirmasSubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1.5" aria-label="Firmas">
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
          </Link>
        );
      })}
    </nav>
  );
}
