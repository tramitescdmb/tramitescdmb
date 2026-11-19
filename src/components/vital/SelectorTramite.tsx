"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { gruposTramites, type TramiteOpcion } from "./tramite-opciones";

/**
 * Selector de trámite con búsqueda en el mismo campo: se escribe y la lista se filtra por
 * cualquier parte del nombre, el código o el número SUIT, sin tildes ni mayúsculas.
 * Mantiene los grupos del catálogo; los trámites sin procedimiento en SIC se ven pero no se eligen.
 */
export function SelectorTramite({
  tramites,
  clave,
  claveSugerida,
  onChange,
  textoNoRadicable = "se gestiona en VITAL",
  etiqueta = "Trámite ambiental en el que se gestiona",
}: {
  tramites: TramiteOpcion[];
  clave: string;
  claveSugerida: string | null;
  onChange: (clave: string) => void;
  /** Nota junto a los trámites que no se pueden elegir (sin procedimiento en SIC). */
  textoNoRadicable?: string;
  etiqueta?: string;
}) {
  const idLista = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [activo, setActivo] = useState(0);

  const elegido = tramites.find((t) => t.clave === clave) ?? null;
  const grupos = useMemo(() => gruposTramites(tramites, abierto ? busqueda : ""), [tramites, busqueda, abierto]);
  const elegibles = grupos.flatMap((g) => g.lista).filter((t) => t.radicable);
  const total = grupos.reduce((n, g) => n + g.lista.length, 0);

  useEffect(() => {
    if (!abierto) return;
    const cerrarFuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) cerrar();
    };
    document.addEventListener("mousedown", cerrarFuera);
    return () => document.removeEventListener("mousedown", cerrarFuera);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    document.getElementById(`${idLista}-${elegibles[activo]?.clave}`)?.scrollIntoView({ block: "nearest" });
  }, [activo, abierto, elegibles, idLista]);

  function abrir() {
    setBusqueda("");
    const i = elegibles.findIndex((t) => t.clave === clave);
    setActivo(i >= 0 ? i : 0);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    setBusqueda("");
  }

  function elegir(t: TramiteOpcion) {
    if (!t.radicable) return;
    onChange(t.clave);
    cerrar();
    campo.current?.blur();
  }

  function teclado(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) return abrir();
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setActivo((i) => (elegibles.length ? (i + paso + elegibles.length) % elegibles.length : 0));
    } else if (e.key === "Enter") {
      if (abierto && elegibles[activo]) {
        e.preventDefault();
        elegir(elegibles[activo]);
      }
    } else if (e.key === "Escape") {
      cerrar();
    }
  }

  const textoElegido = elegido ? `${elegido.nombre} (${elegido.codigo})` : "";

  return (
    <div ref={contenedor} className="relative min-w-0">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          ref={campo}
          type="text"
          role="combobox"
          aria-label={etiqueta}
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={abierto && elegibles[activo] ? `${idLista}-${elegibles[activo].clave}` : undefined}
          value={abierto ? busqueda : textoElegido}
          title={textoElegido || undefined}
          placeholder={abierto ? "Escriba parte del nombre, el código o el SUIT…" : "Seleccione o busque el trámite…"}
          onFocus={abrir}
          onClick={() => !abierto && abrir()}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setActivo(0);
            if (!abierto) setAbierto(true);
          }}
          onKeyDown={teclado}
          className="block w-full min-w-0 truncate rounded-md border border-stone-200 bg-white py-2 pl-8 pr-14 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        />
        <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 text-stone-400">
          {abierto && busqueda && (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setBusqueda("")}
              className="rounded p-0.5 hover:bg-stone-100 hover:text-stone-600"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden />
        </span>
      </div>

      {abierto && (
        <div
          id={idLista}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-md border border-stone-200 bg-white py-1 text-sm shadow-lg"
        >
          {total === 0 && <p className="px-3 py-2 text-stone-500">Ningún trámite coincide con «{busqueda}».</p>}
          {grupos
            .filter((g) => g.lista.length > 0)
            .map((g) => (
              <div key={g.titulo} role="group" aria-label={g.titulo}>
                <p className="sticky top-0 bg-stone-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                  {g.titulo} ({g.lista.length})
                </p>
                {g.lista.map((t) => {
                  const resaltado = abierto && elegibles[activo]?.clave === t.clave;
                  return (
                    <div
                      key={t.clave}
                      id={`${idLista}-${t.clave}`}
                      role="option"
                      aria-selected={t.clave === clave}
                      aria-disabled={!t.radicable}
                      title={t.nombre}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => elegir(t)}
                      onMouseEnter={() => t.radicable && setActivo(elegibles.findIndex((x) => x.clave === t.clave))}
                      className={`px-3 py-1.5 ${
                        t.radicable ? "cursor-pointer text-stone-800" : "cursor-not-allowed text-stone-400"
                      } ${resaltado ? "bg-cdmb-50" : ""} ${t.clave === clave ? "font-medium" : ""}`}
                    >
                      <span className="break-words">{t.nombre}</span>{" "}
                      <span className="text-xs text-stone-500">({t.codigo})</span>
                      {t.clave === claveSugerida && (
                        <span className="ml-1.5 rounded-sm bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">sugerido</span>
                      )}
                      {!t.radicable && <span className="ml-1.5 text-xs">— {textoNoRadicable}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

