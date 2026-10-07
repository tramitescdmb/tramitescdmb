"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { MUNICIPIOS_JURISDICCION_CDMB } from "@/lib/municipios";
import { buscarDepartamentos, buscarMunicipios, DEPARTAMENTO_POR_DEFECTO, type DatosDivipola, type OpcionMunicipio } from "@/lib/divipola";

let cargaDatos: Promise<DatosDivipola> | null = null;

function cargarDivipola(): Promise<DatosDivipola> {
  cargaDatos ??= import("@/lib/divipola-datos").then((m) => ({ departamentos: m.DEPARTAMENTOS_COLOMBIA, municipios: m.MUNICIPIOS_COLOMBIA }));
  return cargaDatos;
}

type Valor = { departamento: string; ciudad: string };

function Autocompletar<T>({
  etiqueta,
  valor,
  placeholder,
  sugerencias,
  textoOpcion,
  detalleOpcion,
  onEscribir,
  onElegir,
  onAbrir,
  claseCampo,
}: {
  etiqueta: string;
  valor: string;
  placeholder: string;
  sugerencias: T[];
  textoOpcion: (o: T) => string;
  detalleOpcion?: (o: T) => string | null;
  onEscribir: (v: string) => void;
  onElegir: (o: T) => void;
  onAbrir: () => void;
  claseCampo: string;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);

  const elegir = (o: T) => {
    onElegir(o);
    setAbierto(false);
  };

  return (
    <div ref={contenedor} className="relative">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-stone-700">
        {etiqueta}
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={abierto && sugerencias.length > 0}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        autoComplete="off"
        value={valor}
        placeholder={placeholder}
        onFocus={() => {
          onAbrir();
          setAbierto(true);
          setActivo(0);
        }}
        onChange={(e) => {
          onEscribir(e.target.value);
          setAbierto(true);
          setActivo(0);
        }}
        onKeyDown={(e) => {
          if (!abierto || sugerencias.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActivo((a) => Math.min(a + 1, sugerencias.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActivo((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            elegir(sugerencias[activo]!);
          } else if (e.key === "Escape") {
            setAbierto(false);
          }
        }}
        className={claseCampo}
      />
      {abierto && sugerencias.length > 0 && (
        <ul id={`${id}-lista`} role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-stone-200 bg-white py-1 text-sm shadow-lg">
          {sugerencias.map((o, i) => (
            <li key={`${textoOpcion(o)}-${detalleOpcion?.(o) ?? ""}`} role="option" aria-selected={i === activo}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActivo(i)}
                onClick={() => elegir(o)}
                className={`flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left ${i === activo ? "bg-cdmb-50" : ""}`}
              >
                <span className="text-stone-800">{textoOpcion(o)}</span>
                {detalleOpcion?.(o) && <span className="truncate text-xs text-stone-400">{detalleOpcion(o)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SelectorDepartamentoCiudad({
  valor,
  onChange,
  claseCampo,
}: {
  valor: Valor;
  onChange: (v: Valor) => void;
  claseCampo: string;
}) {
  const [datos, setDatos] = useState<DatosDivipola | null>(null);
  const cargar = () => {
    if (!datos) cargarDivipola().then(setDatos).catch(() => {});
  };

  const departamentos = datos ? buscarDepartamentos(datos, valor.departamento) : [];
  const enDepartamento: OpcionMunicipio[] = datos ? buscarMunicipios(datos, valor.ciudad, valor.departamento) : [];
  const municipios = datos && valor.ciudad.trim() && enDepartamento.length === 0 ? buscarMunicipios(datos, valor.ciudad, "") : enDepartamento;

  const esRapida = (m: string) => valor.ciudad === m && valor.departamento === DEPARTAMENTO_POR_DEFECTO;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-[11px] font-medium text-stone-500">
          <MapPin className="h-3 w-3" aria-hidden />
          Jurisdicción CDMB:
        </span>
        {MUNICIPIOS_JURISDICCION_CDMB.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ departamento: DEPARTAMENTO_POR_DEFECTO, ciudad: m })}
            aria-pressed={esRapida(m)}
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
              esRapida(m) ? "border-menu-500 bg-menu-500 text-stone-900" : "border-stone-200 bg-white text-stone-600 hover:border-cdmb-300 hover:bg-cdmb-50"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Autocompletar
          etiqueta="Departamento"
          valor={valor.departamento}
          placeholder="Escriba para buscar…"
          sugerencias={departamentos}
          textoOpcion={(d) => d}
          onAbrir={cargar}
          onEscribir={(departamento) => onChange({ ...valor, departamento })}
          onElegir={(departamento) => onChange({ departamento, ciudad: departamento === valor.departamento ? valor.ciudad : "" })}
          claseCampo={claseCampo}
        />
        <Autocompletar
          etiqueta="Ciudad o municipio"
          valor={valor.ciudad}
          placeholder="Escriba para buscar…"
          sugerencias={municipios}
          textoOpcion={(m) => m.nombre}
          detalleOpcion={(m) => (m.departamento === valor.departamento ? null : m.departamento)}
          onAbrir={cargar}
          onEscribir={(ciudad) => onChange({ ...valor, ciudad })}
          onElegir={(m) => onChange({ departamento: m.departamento, ciudad: m.nombre })}
          claseCampo={claseCampo}
        />
      </div>
    </div>
  );
}
