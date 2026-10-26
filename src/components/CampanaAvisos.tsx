"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBell } from "@tabler/icons-react";

type Aviso = { clave: string; titulo: string; detalle?: string; href: string; alerta: boolean; cantidad: number; modulo?: string };

export const EVENTO_AVISOS = "avisos-actualizados";

let ultimos: Aviso[] = [];

export function ultimosAvisos(): Aviso[] {
  return ultimos;
}

const CADA_MS = 120_000;

export function CampanaAvisos() {
  const pathname = usePathname();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/avisos", { cache: "no-store" });
      if (!res.ok) return;
      const lista: Aviso[] = (await res.json()).avisos ?? [];
      setAvisos(lista);
      ultimos = lista;
      window.dispatchEvent(new CustomEvent(EVENTO_AVISOS, { detail: lista }));
    } catch {}
  }, []);

  useEffect(() => {
    void cargar();
    setAbierto(false);
  }, [pathname, cargar]);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void cargar();
    }, CADA_MS);
    return () => clearInterval(t);
  }, [cargar]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const total = avisos.reduce((s, a) => s + a.cantidad, 0);
  const urgente = avisos.some((a) => a.alerta);

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={total > 0 ? `Avisos: ${total}` : "Avisos"}
        title="Avisos"
        className="relative flex h-9 w-9 items-center justify-center rounded text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
      >
        <IconBell className="h-5 w-5" stroke={1.75} aria-hidden />
        {total > 0 && (
          <span
            className={`absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-sm px-1 text-center text-[10px] font-bold leading-[1.1rem] text-white ${urgente ? "bg-red-600" : "bg-acento-500"}`}
          >
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-40 mt-1 w-80 overflow-hidden rounded-md border border-stone-200 bg-white shadow-soft-lg">
          <p className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Avisos</p>
          {avisos.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-stone-400">Sin avisos pendientes.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {avisos.map((a) => (
                <li key={a.clave}>
                  <Link href={a.href} className="relative flex items-start gap-3 px-4 py-2.5 hover:bg-stone-50">
                    <span className={`absolute inset-y-0 left-0 w-[3px] ${a.alerta ? "bg-red-500" : "bg-acento-500"}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-stone-800">{a.titulo}</span>
                      {a.detalle && <span className={`block text-xs ${a.alerta ? "text-red-600" : "text-stone-500"}`}>{a.detalle}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/" className="block border-t border-stone-200 px-4 py-2 text-center text-xs font-medium text-cdmb-700 hover:bg-stone-50">
            Ver todos los pendientes en Inicio
          </Link>
        </div>
      )}
    </div>
  );
}
