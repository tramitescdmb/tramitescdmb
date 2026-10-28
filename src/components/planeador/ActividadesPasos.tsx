"use client";

import { useMemo, useState } from "react";
import { Search, Check, Loader2 } from "lucide-react";
import type { TipoActividadPaso } from "@prisma/client";
import { ETIQUETA_TIPO_ACTIVIDAD } from "@/lib/temas-visita";

type Paso = { id: string; numero: number; titulo: string; tipoActividad: TipoActividadPaso | null; detectado: TipoActividadPaso; formatoVisitaId: string | null };

export type TramiteActividades = {
  codigo: string;
  nombre: string;
  formatoDelTramite: string | null;
  flujos: { id: string; nombre: string; pasos: Paso[] }[];
};

const TIPOS = Object.keys(ETIQUETA_TIPO_ACTIVIDAD) as TipoActividadPaso[];
const DE_VISITA: TipoActividadPaso[] = ["VISITA_TECNICA", "PROGRAMAR_VISITA"];

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function FilaPaso({ paso: inicial, formatos, formatoDelTramite }: { paso: Paso; formatos: { id: string; nombre: string }[]; formatoDelTramite: string | null }) {
  const [paso, setPaso] = useState(inicial);
  const [estado, setEstado] = useState<"" | "guardando" | "ok" | string>("");
  const efectivo = paso.tipoActividad ?? paso.detectado;
  const esVisita = DE_VISITA.includes(efectivo);

  async function guardar(cambio: { tipoActividad?: TipoActividadPaso | null; formatoVisitaId?: string | null }) {
    const anterior = paso;
    setPaso({ ...paso, ...cambio });
    setEstado("guardando");
    try {
      const res = await fetch(`/api/pasos-tramite/${paso.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cambio) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPaso(anterior);
        setEstado(data.error || "No se pudo guardar.");
        return;
      }
      setPaso((p) => ({ ...p, tipoActividad: data.tipoActividad, formatoVisitaId: data.formatoVisitaId }));
      setEstado("ok");
    } catch {
      setPaso(anterior);
      setEstado("No se pudo guardar.");
    }
  }

  return (
    <tr className="border-t border-stone-100 align-middle">
      <td className="w-10 px-3 py-1.5 text-right tabular-nums text-stone-400">{paso.numero}</td>
      <td className="px-3 py-1.5 text-stone-800">{paso.titulo.charAt(0) + paso.titulo.slice(1).toLowerCase()}</td>
      <td className="px-3 py-1.5">
        <select
          value={paso.tipoActividad ?? ""}
          onChange={(e) => guardar({ tipoActividad: (e.target.value || null) as TipoActividadPaso | null })}
          aria-label={`Actividad del paso ${paso.numero}`}
          className={`w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs ${paso.tipoActividad ? "font-medium text-stone-800" : "text-stone-500"}`}
        >
          <option value="">Automática ({ETIQUETA_TIPO_ACTIVIDAD[paso.detectado].toLowerCase()})</option>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO_ACTIVIDAD[t]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-1.5">
        {esVisita ? (
          <select
            value={paso.formatoVisitaId ?? ""}
            onChange={(e) => guardar({ formatoVisitaId: e.target.value || null })}
            aria-label={`Formato de visita del paso ${paso.numero}`}
            className={`w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs ${paso.formatoVisitaId ? "font-medium text-stone-800" : "text-stone-500"}`}
          >
            <option value="">Según el trámite{formatoDelTramite ? ` (${formatoDelTramite})` : " (hoja con temas)"}</option>
            {formatos.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-stone-300">—</span>
        )}
      </td>
      <td className="w-28 px-3 py-1.5 text-xs">
        {estado === "guardando" && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" aria-label="Guardando" />}
        {estado === "ok" && <Check className="h-3.5 w-3.5 text-emerald-600" aria-label="Guardado" />}
        {estado && estado !== "guardando" && estado !== "ok" && <span className="text-red-700">{estado}</span>}
      </td>
    </tr>
  );
}

export function ActividadesPasos({ tramites, formatos, abierto }: { tramites: TramiteActividades[]; formatos: { id: string; nombre: string }[]; abierto: string | null }) {
  const [texto, setTexto] = useState("");
  const filtrados = useMemo(() => {
    const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return tramites;
    return tramites.filter((t) => {
      const base = normalizar(`${t.nombre} ${t.codigo} ${t.flujos.map((f) => f.nombre).join(" ")}`);
      return palabras.every((p) => base.includes(p));
    });
  }, [texto, tramites]);

  return (
    <div className="space-y-3">
      <label className="relative block max-w-xl">
        <span className="sr-only">Buscar trámite</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar trámite por nombre o código"
          className="w-full rounded-md border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        />
      </label>

      {filtrados.length === 0 && <p className="rounded-md border border-dashed border-stone-200 p-4 text-center text-sm text-stone-500">Ningún trámite coincide con la búsqueda.</p>}

      {filtrados.map((t) => {
        const definidos = t.flujos.reduce((a, f) => a + f.pasos.filter((p) => p.tipoActividad).length, 0);
        const total = t.flujos.reduce((a, f) => a + f.pasos.length, 0);
        return (
          <details key={t.codigo} open={abierto === t.codigo || filtrados.length === 1} className="rounded-md border border-stone-200 bg-white">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="font-medium text-stone-900">{t.nombre}</span>
              <span className="font-mono text-[11px] text-stone-400">{t.codigo}</span>
              <span className="ml-auto text-xs text-stone-500">
                {definidos} de {total} pasos definidos
              </span>
            </summary>
            {t.flujos.map((f) => (
              <div key={f.id} className="overflow-x-auto border-t border-stone-100">
                {t.flujos.length > 1 && <p className="bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">{f.nombre}</p>}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-stone-500">
                      <th className="px-3 py-1.5 text-right font-medium">N.º</th>
                      <th className="px-3 py-1.5 font-medium">Paso</th>
                      <th className="w-64 px-3 py-1.5 font-medium">Actividad</th>
                      <th className="w-80 px-3 py-1.5 font-medium">Formato de visita</th>
                      <th className="px-3 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {f.pasos.map((p) => (
                      <FilaPaso key={p.id} paso={p} formatos={formatos} formatoDelTramite={t.formatoDelTramite} />
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </details>
        );
      })}
    </div>
  );
}
