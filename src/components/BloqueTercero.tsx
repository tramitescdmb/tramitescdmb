"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { CamposPersona } from "@/components/CamposPersona";
import type { DatosPersona, OpcionIdentificacion } from "@/lib/datos-persona";
import type { TerceroEncontrado } from "@/lib/terceros";

export function BloqueTercero({
  valor,
  onChange,
  tiposIdentificacion,
  deshabilitado = false,
  requeridos,
}: {
  valor: DatosPersona;
  onChange: (p: DatosPersona) => void;
  tiposIdentificacion?: OpcionIdentificacion[];
  deshabilitado?: boolean;
  requeridos?: Parameters<typeof CamposPersona>[0]["requeridos"];
}) {
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<TerceroEncontrado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [cargado, setCargado] = useState<string | null>(null);
  const turno = useRef(0);

  useEffect(() => {
    const q = consulta.trim();
    if (q.length < 2) {
      setResultados(null);
      return;
    }
    const mio = ++turno.current;
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(`/api/correspondencia/tercero?q=${encodeURIComponent(q)}`);
        const body = await res.json().catch(() => ({}));
        if (mio === turno.current) setResultados(res.ok ? body.resultados : []);
      } finally {
        if (mio === turno.current) setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [consulta]);

  function elegir(t: TerceroEncontrado) {
    onChange(t.persona);
    setCargado(t.nombre);
    setConsulta("");
    setResultados(null);
  }

  async function autocompletarPorDocumento(identificacion: string) {
    if (identificacion.length < 4 || valor.nombres.trim() || valor.razonSocial.trim()) return;
    try {
      const res = await fetch(`/api/correspondencia/tercero?q=${encodeURIComponent(identificacion)}`);
      const body = await res.json().catch(() => ({}));
      const exacto = (body.resultados as TerceroEncontrado[] | undefined)?.find((t) => t.identificacion === identificacion);
      if (exacto) elegir(exacto);
    } catch {}
  }

  return (
    <fieldset disabled={deshabilitado} className="space-y-3 disabled:opacity-80">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar un tercero registrado por documento, nombres, apellidos o razón social…"
          aria-label="Buscar tercero registrado"
          className="w-full rounded-lg border border-stone-200 bg-stone-50/60 py-2 pl-9 pr-9 text-sm focus:border-vivo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-vivo-500"
        />
        {buscando && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-400" aria-hidden />}
        {resultados && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 text-sm shadow-lg">
            {resultados.length === 0 ? (
              <li className="px-3 py-2 text-xs text-stone-500">Sin coincidencias. Diligencie los datos abajo: se registra al radicar.</li>
            ) : (
              resultados.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => elegir(t)} className="flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left hover:bg-cdmb-50">
                    <span className="truncate text-stone-800">{t.nombre}</span>
                    <span className="flex-none text-xs text-stone-400">
                      {t.identificacion}
                      {t.ciudad ? ` · ${t.ciudad}` : ""}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {cargado && <p className="text-xs text-cdmb-700">Datos cargados de {cargado}; puede corregirlos.</p>}
      <CamposPersona
        valor={valor}
        onChange={onChange}
        tiposIdentificacion={tiposIdentificacion}
        requeridos={requeridos ?? { nombre: true }}
        onIdentificacionLista={autocompletarPorDocumento}
      />
    </fieldset>
  );
}
