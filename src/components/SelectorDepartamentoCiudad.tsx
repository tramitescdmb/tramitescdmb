"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Building, Map, type LucideIcon } from "lucide-react";
import { buscarDepartamentos, buscarMunicipios, type DatosDivipola, type OpcionMunicipio } from "@/lib/divipola";

let cargaDatos: Promise<DatosDivipola> | null = null;

function cargarDivipola(): Promise<DatosDivipola> {
  cargaDatos ??= import("@/lib/divipola-datos").then((m) => ({ departamentos: m.DEPARTAMENTOS_COLOMBIA, municipios: m.MUNICIPIOS_COLOMBIA }));
  return cargaDatos;
}

type Valor = { departamento: string; ciudad: string };

function Autocompletar<T>({
  etiqueta,
  icono: Icono,
  requerido,
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
  icono: LucideIcon;
  requerido?: boolean;
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
      <label htmlFor={id} className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-700">
        <Icono className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
        {etiqueta}
        {requerido && <span className="ml-1 text-red-500">*</span>}
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
  requerido = false,
}: {
  valor: Valor;
  onChange: (v: Valor) => void;
  claseCampo: string;
  requerido?: boolean;
}) {
  const [datos, setDatos] = useState<DatosDivipola | null>(null);
  const cargar = () => {
    if (!datos) cargarDivipola().then(setDatos).catch(() => {});
  };

  const departamentos = datos ? buscarDepartamentos(datos, valor.departamento) : [];
  const enDepartamento: OpcionMunicipio[] = datos ? buscarMunicipios(datos, valor.ciudad, valor.departamento) : [];
  const municipios = datos && valor.ciudad.trim() && enDepartamento.length === 0 ? buscarMunicipios(datos, valor.ciudad, "") : enDepartamento;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
        <Autocompletar
          etiqueta="Departamento"
          icono={Map}
          requerido={requerido}
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
          icono={Building}
          requerido={requerido}
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
  );
}
