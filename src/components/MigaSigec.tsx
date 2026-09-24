"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const INICIO_GRUPO: Record<string, string> = {
  Panel: "/contratacion/panel",
  Expedientes: "/contratacion/expedientes",
  "Buzón de firmas": "/contratacion/buzon",
  "Mis firmas": "/contratacion/mis-firmas",
  Contratistas: "/contratacion/contratistas",
  Ayuda: "/contratacion/ayuda",
};

const RUTAS: { re: RegExp; trail: string[] }[] = [
  { re: /^\/contratacion\/expedientes\/nuevo/, trail: ["Expedientes", "Nuevo expediente"] },
  { re: /^\/contratacion\/expedientes\/[^/]+\/ficha-firma/, trail: ["Expedientes", "Expediente", "Ficha de firma"] },
  { re: /^\/contratacion\/expedientes\/[^/]+\/rotulo/, trail: ["Expedientes", "Expediente", "Rótulo"] },
  { re: /^\/contratacion\/expedientes\/[^/]+/, trail: ["Expedientes", "Expediente"] },
  { re: /^\/contratacion\/expedientes$/, trail: ["Expedientes"] },
  { re: /^\/contratacion\/firmar\/[^/]+/, trail: ["Buzón de firmas", "Firmar documento"] },
  { re: /^\/contratacion\/buzon/, trail: ["Buzón de firmas"] },
  { re: /^\/contratacion\/mis-firmas/, trail: ["Mis firmas"] },
  { re: /^\/contratacion\/panel\/expedientes/, trail: ["Panel", "Expedientes"] },
  { re: /^\/contratacion\/panel\/indicadores/, trail: ["Panel", "Indicadores"] },
  { re: /^\/contratacion\/panel\/sistema/, trail: ["Panel", "Sistema"] },
  { re: /^\/contratacion\/panel/, trail: ["Panel", "Mi trabajo pendiente"] },
  { re: /^\/contratacion\/contratistas\/nuevo/, trail: ["Contratistas", "Nuevo contratista"] },
  { re: /^\/contratacion\/contratistas\/[^/]+/, trail: ["Contratistas", "Contratista"] },
  { re: /^\/contratacion\/contratistas$/, trail: ["Contratistas"] },
  { re: /^\/contratacion\/catalogo/, trail: ["Configuración", "Catálogo de requisitos"] },
  { re: /^\/contratacion\/bitacora/, trail: ["Administración", "Bitácora del SIGEC"] },
  { re: /^\/contratacion\/auditoria/, trail: ["Administración", "Auditoría de cuentas"] },
  { re: /^\/contratacion\/seguridad/, trail: ["Administración", "Seguridad"] },
  { re: /^\/contratacion\/ayuda/, trail: ["Ayuda"] },
];

export function MigaSigec() {
  const pathname = usePathname();
  const match = RUTAS.find((r) => r.re.test(pathname));
  const trail = match?.trail ?? [];

  return (
    <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5 text-xs text-stone-400">
      <Link href="/contratacion/panel" className="flex items-center gap-1 hover:text-cdmb-700">
        <Home className="h-3.5 w-3.5" aria-hidden />
        SIGEC
      </Link>
      {trail.map((paso, i) => {
        const ultimo = i === trail.length - 1;
        const href = i === 0 ? INICIO_GRUPO[paso] : undefined;
        return (
          <Fragment key={`${paso}-${i}`}>
            <ChevronRight className="h-3.5 w-3.5 flex-none text-stone-300" aria-hidden />
            {ultimo ? (
              <span className="font-medium text-stone-600" aria-current="page">
                {paso}
              </span>
            ) : href ? (
              <Link href={href} className="hover:text-cdmb-700">
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
