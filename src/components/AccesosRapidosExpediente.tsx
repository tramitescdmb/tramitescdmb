"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, FolderOpen, Plus, UserCheck } from "lucide-react";
import type { EnlaceAcceso } from "@/lib/accesos-expediente";

const PRIMARIO = "inline-flex flex-none items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cdmb-700";
const SECUNDARIO =
  "inline-flex flex-none items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm transition hover:border-cdmb-400 hover:text-cdmb-800";

function Desplegable({ boton, enlaces, clase, Icono }: { boton: string; enlaces: EnlaceAcceso[]; clase: string; Icono: typeof Plus }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const pathname = usePathname();

  useEffect(() => setAbierto(false), [pathname]);

  useEffect(() => {
    if (!abierto) return;
    const alClic = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    };
    const alTeclado = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", alClic);
    document.addEventListener("keydown", alTeclado);
    return () => {
      document.removeEventListener("mousedown", alClic);
      document.removeEventListener("keydown", alTeclado);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className="relative flex-none">
      <button type="button" aria-haspopup="menu" aria-expanded={abierto} aria-controls={menuId} onClick={() => setAbierto((v) => !v)} className={clase}>
        <Icono className="h-4 w-4" aria-hidden />
        {boton}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {abierto && (
        <div id={menuId} role="menu" className="absolute right-0 top-full z-30 mt-1.5 min-w-[14rem] rounded-lg border border-stone-200 bg-white p-1 shadow-xl ring-1 ring-black/5">
          {enlaces.map((e) => (
            <Link key={e.href} prefetch={false} role="menuitem" href={e.href} className="block rounded-md px-3 py-2 text-sm text-stone-700 hover:bg-cdmb-50 hover:text-cdmb-800">
              {e.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AccesosRapidosExpediente({ nuevos, listados, propio }: { nuevos: EnlaceAcceso[]; listados: EnlaceAcceso[]; propio?: EnlaceAcceso | null }) {
  if (nuevos.length === 0 && listados.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {propio && (
        <Link prefetch={false} href={propio.href} className={SECUNDARIO}>
          <UserCheck className="h-4 w-4 text-cdmb-600" aria-hidden />
          {propio.label}
        </Link>
      )}
      {listados.length === 1 && (
        <Link prefetch={false} href={listados[0]!.href} className={SECUNDARIO}>
          <FolderOpen className="h-4 w-4 text-cdmb-600" aria-hidden />
          {listados[0]!.label}
        </Link>
      )}
      {listados.length > 1 && <Desplegable boton="Expedientes" enlaces={listados} clase={SECUNDARIO} Icono={FolderOpen} />}
      {nuevos.length === 1 && (
        <Link prefetch={false} href={nuevos[0]!.href} className={PRIMARIO}>
          <Plus className="h-4 w-4" aria-hidden />
          {nuevos[0]!.label}
        </Link>
      )}
      {nuevos.length > 1 && <Desplegable boton="Nuevo" enlaces={nuevos} clase={PRIMARIO} Icono={Plus} />}
    </div>
  );
}
