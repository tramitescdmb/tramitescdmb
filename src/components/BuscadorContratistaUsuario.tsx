"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Search, UserRoundPen } from "lucide-react";
import { CamposPersona } from "@/components/CamposPersona";
import { TIPOS_IDENTIFICACION_USUARIO, type DatosPersona } from "@/lib/datos-persona";

export type ContratistaElegido = { usuarioId: string; nombre: string; identificacion: string };

type Resultado = {
  usuarioId: string;
  nombre: string;
  tipoPersona: "NATURAL" | "JURIDICA";
  identificacion: string;
  ciudad: string;
  dependencia: string | null;
  faltantes: string[];
  persona: DatosPersona;
};

export function BuscadorContratistaUsuario({
  onElegir,
  enlaceUsuarios,
  claseCampo,
}: {
  onElegir: (c: ContratistaElegido) => void;
  enlaceUsuarios?: string | null;
  claseCampo?: string;
}) {
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [completando, setCompletando] = useState<Resultado | null>(null);
  const [persona, setPersona] = useState<DatosPersona | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    if (r.faltantes.length === 0) {
      onElegir({ usuarioId: r.usuarioId, nombre: r.nombre, identificacion: r.identificacion });
      return;
    }
    setCompletando(r);
    setPersona(r.persona);
  }

  async function guardarDatos() {
    if (!completando || !persona) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/personas/${completando.usuarioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudieron guardar los datos.");
      if ((body.faltantes as string[]).length > 0) {
        setError(`Aún faltan: ${(body.faltantes as string[]).join(", ")}.`);
        return;
      }
      onElegir({ usuarioId: completando.usuarioId, nombre: body.nombre, identificacion: body.identificacion });
      setCompletando(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  if (completando && persona) {
    return (
      <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/60 p-3.5">
        <p className="flex items-start gap-1.5 text-xs text-amber-900">
          <UserRoundPen className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
          <span>
            Complete los datos de <strong>{completando.nombre}</strong> para iniciar el contrato. Faltan: {completando.faltantes.join(", ")}.
          </span>
        </p>
        <div className="rounded-lg bg-white p-3">
          <CamposPersona
            valor={persona}
            onChange={setPersona}
            tiposIdentificacion={TIPOS_IDENTIFICACION_USUARIO}
            tributaria
            requeridos={{ identificacion: true, nombre: true, email: true, direccion: true, ubicacion: true, regimenTributario: true }}
            claseCampo={claseCampo}
          />
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={guardarDatos}
            disabled={guardando}
            className="rounded-lg bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600 disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar datos y seleccionar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCompletando(null);
              setError(null);
            }}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            Volver a la búsqueda
          </button>
        </div>
      </div>
    );
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
                    Completar datos
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {resultados && resultados.length === 0 && !buscando && (
        <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
          Ningún usuario coincide. El contratista debe estar registrado como usuario de la plataforma (persona natural o jurídica).
          {enlaceUsuarios && (
            <>
              {" "}
              <a href={enlaceUsuarios} target="_blank" rel="noopener noreferrer" className="font-medium text-cdmb-700 underline hover:no-underline">
                Registrar usuario
              </a>
            </>
          )}
        </p>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
