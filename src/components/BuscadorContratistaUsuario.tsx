"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Search } from "lucide-react";

export type ContratistaElegido = { usuarioId: string; nombre: string; identificacion: string };

type Resultado = {
  usuarioId: string;
  nombre: string;
  tipoPersona: "NATURAL" | "JURIDICA";
  identificacion: string;
  ciudad: string;
  dependencia: string | null;
  faltantes: string[];
};

export function BuscadorContratistaUsuario({
  onElegir,
  claseCampo,
}: {
  onElegir: (c: ContratistaElegido) => void;
  claseCampo?: string;
}) {
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [incompleto, setIncompleto] = useState<Resultado | null>(null);
  const turno = useRef(0);

  useEffect(() => {
    const q = consulta.trim();
    setIncompleto(null);
    if (q.length < 2) {
      setResultados(null);
      return;
    }
    const mio = ++turno.current;
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(`/api/contratacion/contratistas/buscar?q=${encodeURIComponent(q)}`);
        const body = await res.json().catch(() => ({}));
        if (mio === turno.current) setResultados(res.ok ? (body.resultados as Resultado[]) : []);
      } finally {
        if (mio === turno.current) setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [consulta]);

  function elegir(r: Resultado) {
    if (r.faltantes.length > 0) {
      setIncompleto(r);
      return;
    }
    onElegir({ usuarioId: r.usuarioId, nombre: r.nombre, identificacion: r.identificacion });
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar por documento, nombres o apellidos…"
          aria-label="Buscar contratista"
          className={`${claseCampo ?? "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"} pl-9`}
        />
        {buscando && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-400" aria-hidden />}
      </div>

      {resultados && resultados.length > 0 && (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {resultados.map((r) => (
            <li key={r.usuarioId}>
              <button type="button" onClick={() => elegir(r)} className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-cdmb-50/60">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-stone-800">{r.nombre}</span>
                  <span className="block truncate text-xs text-stone-500">
                    {r.identificacion ? `${r.tipoPersona === "JURIDICA" ? "NIT" : "C.C."} ${r.identificacion}` : "Sin documento"}
                    {r.ciudad ? ` · ${r.ciudad}` : ""}
                    {r.dependencia ? ` · ${r.dependencia}` : ""}
                  </span>
                </span>
                {r.faltantes.length === 0 ? (
                  <span className="flex flex-none items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Datos completos
                  </span>
                ) : (
                  <span className="flex flex-none items-center gap-1 text-[11px] font-medium text-amber-700" title={`Faltan: ${r.faltantes.join(", ")}`}>
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    Datos incompletos
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {incompleto && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {incompleto.nombre} no tiene completos sus datos ({incompleto.faltantes.join(", ")}). El administrador del sistema debe completarlos en
          Usuarios antes de iniciar el contrato.
        </p>
      )}

      {resultados && resultados.length === 0 && !buscando && (
        <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
          Ningún usuario coincide con «{consulta.trim()}». Los contratistas los registra el administrador del sistema en Usuarios.
        </p>
      )}
    </div>
  );
}
