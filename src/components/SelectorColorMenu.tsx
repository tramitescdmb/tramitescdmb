"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconPalette } from "@tabler/icons-react";
import { COOKIE_TEMA_MENU, TEMAS_MENU, temaMenuValido, type TemaMenu } from "@/lib/tema-menu";

/** Aplica el color al instante (atributo en <html>) y lo recuerda un año en este navegador. */
function aplicarTema(id: TemaMenu) {
  document.documentElement.dataset.temaMenu = id;
  const segura = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${COOKIE_TEMA_MENU}=${id}; path=/; max-age=31536000; samesite=lax${segura}`;
}

/**
 * Botón «Color del menú» con una paleta corta. Solo cambia la apariencia de la barra lateral;
 * no recarga la página ni consulta el servidor.
 */
export function SelectorColorMenu({ colapsado = false, abreHacia = "arriba" }: { colapsado?: boolean; abreHacia?: "arriba" | "derecha" }) {
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState<TemaMenu>("verde");
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  function escoger(id: TemaMenu) {
    aplicarTema(id);
    setActual(id);
    setAbierto(false);
  }

  const posicion = abreHacia === "derecha" ? "bottom-0 left-full ml-2" : "bottom-full right-0 mb-2";

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => {
          setActual(temaMenuValido(document.documentElement.dataset.temaMenu));
          setAbierto((v) => !v);
        }}
        aria-expanded={abierto}
        aria-label="Color del menú"
        title="Color del menú"
        className={`flex items-center justify-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lateral-acento ${
          colapsado ? "h-9 w-9" : "h-8 w-8"
        }`}
      >
        <IconPalette className="h-[18px] w-[18px]" stroke={1.75} aria-hidden />
      </button>

      {abierto && (
        <div role="group" aria-label="Color del menú" className={`absolute z-50 w-56 rounded-lg border border-stone-200 bg-white p-2 text-stone-800 shadow-soft-lg ${posicion}`}>
          <p className="px-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">Color del menú</p>
          <ul className="space-y-0.5">
            {TEMAS_MENU.map((t) => {
              const elegido = t.id === actual;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-pressed={elegido}
                    onClick={() => escoger(t.id)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left text-[13px] transition-colors hover:bg-stone-100 focus:bg-stone-100 focus:outline-none ${
                      elegido ? "font-semibold" : ""
                    }`}
                  >
                    <span className="relative flex h-6 w-6 flex-none overflow-hidden rounded-full ring-1 ring-black/10" style={{ backgroundColor: t.muestra }} aria-hidden>
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-tl-full" style={{ backgroundColor: t.acento }} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {t.nombre}
                      {t.id === "verde" && <span className="block text-[11px] font-normal text-stone-500">Predeterminado</span>}
                    </span>
                    {elegido && <IconCheck className="h-4 w-4 flex-none text-cdmb-700" stroke={2} aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
