"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

/**
 * Ruta de migas del SGDEA — "usted está aquí". Se calcula del pathname contra
 * una tabla ordenada (primer patrón que coincide gana). El primer nivel siempre
 * es el módulo; el segundo, el menú al que pertenece la pantalla, enlaza a su
 * inicio.
 */

const INICIO_GRUPO: Record<string, string> = {
  Panel: "/correspondencia/panel",
  Correspondencia: "/correspondencia",
  "Expedientes y archivo": "/correspondencia/expedientes",
  Plantillas: "/correspondencia/plantillas",
  Configuración: "/correspondencia/admin",
  Administración: "/correspondencia/bitacora",
  Ayuda: "/correspondencia/ayuda",
};

const RUTAS: { re: RegExp; trail: string[] }[] = [
  { re: /^\/correspondencia\/panel\/correspondencia$/, trail: ["Panel", "Correspondencia"] },
  { re: /^\/correspondencia\/panel\/archivo$/, trail: ["Panel", "Expedientes y archivo"] },
  { re: /^\/correspondencia\/panel\/sistema$/, trail: ["Panel", "Sistema"] },
  { re: /^\/correspondencia\/panel$/, trail: ["Panel", "Mi trabajo pendiente"] },
  { re: /^\/correspondencia\/nueva\/enviada/, trail: ["Correspondencia", "Radicar enviada"] },
  { re: /^\/correspondencia\/nueva\/interna/, trail: ["Correspondencia", "Radicar memorando"] },
  { re: /^\/correspondencia\/nueva/, trail: ["Correspondencia", "Radicar recibida"] },
  { re: /^\/correspondencia\/expedientes\/nuevo/, trail: ["Expedientes y archivo", "Abrir expediente"] },
  { re: /^\/correspondencia\/expedientes\/[^/]+\/ficha/, trail: ["Expedientes y archivo", "Expedientes", "Ficha del expediente"] },
  { re: /^\/correspondencia\/expedientes\/[^/]+/, trail: ["Expedientes y archivo", "Expedientes", "Expediente"] },
  { re: /^\/correspondencia\/expedientes/, trail: ["Expedientes y archivo", "Expedientes"] },
  { re: /^\/correspondencia\/disposicion/, trail: ["Expedientes y archivo", "Disposición final"] },
  { re: /^\/correspondencia\/plantillas/, trail: ["Plantillas"] },
  { re: /^\/correspondencia\/admin\/vocabulario/, trail: ["Configuración", "Vocabulario controlado"] },
  { re: /^\/correspondencia\/admin\/flujos\/[^/]+/, trail: ["Configuración", "Flujos de trabajo", "Editar flujo"] },
  { re: /^\/correspondencia\/admin\/flujos/, trail: ["Configuración", "Flujos de trabajo"] },
  { re: /^\/correspondencia\/admin/, trail: ["Configuración", "Dependencias y TRD"] },
  { re: /^\/correspondencia\/calendario-laboral/, trail: ["Configuración", "Calendario laboral"] },
  { re: /^\/correspondencia\/bitacora/, trail: ["Administración", "Bitácora inalterable"] },
  { re: /^\/correspondencia\/ayuda/, trail: ["Ayuda"] },
  { re: /^\/correspondencia\/[^/]+\/constancia/, trail: ["Correspondencia", "Constancia de radicación"] },
  { re: /^\/correspondencia\/[^/]+$/, trail: ["Correspondencia", "Detalle del radicado"] },
  { re: /^\/correspondencia$/, trail: ["Correspondencia", "Bandeja"] },
];

export function MigaSgdea() {
  const pathname = usePathname();
  const match = RUTAS.find((r) => r.re.test(pathname));
  const trail = match?.trail ?? [];

  return (
    <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5 text-xs text-stone-400">
      <Link href="/correspondencia/panel" className="flex items-center gap-1 hover:text-cdmb-700">
        <Home className="h-3.5 w-3.5" aria-hidden />
        SGDEA
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
