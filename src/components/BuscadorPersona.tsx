"use client";

import { useState } from "react";
import { X } from "lucide-react";

type Persona = { id: string; nombre: string; detalle?: string | null };

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function BuscadorPersona({
  name,
  personas,
  inicial = null,
  requerido = false,
  placeholder = "Buscar persona por nombre…",
}: {
  name: string;
  personas: Persona[];
  inicial?: string | null;
  requerido?: boolean;
  placeholder?: string;
}) {
  const [seleccion, setSeleccion] = useState<Persona | null>(personas.find((p) => p.id === inicial) ?? null);
  const [texto, setTexto] = useState("");
  const q = normalizar(texto.trim());
  const coincidentes = q.length >= 2 ? personas.filter((p) => normalizar(`${p.nombre} ${p.detalle ?? ""}`).includes(q)) : [];

  return (
    <div className="space-y-1">
      <input type="hidden" name={name} value={seleccion?.id ?? ""} />
      {seleccion ? (
        <span className="inline-flex items-center gap-1 rounded-sm bg-cdmb-50 px-2 py-1 text-sm text-cdmb-800">
          {seleccion.nombre}
          <button type="button" onClick={() => setSeleccion(null)} aria-label={`Quitar a ${seleccion.nombre}`} className="rounded-full text-cdmb-600 hover:bg-cdmb-100">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      ) : (
        <>
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={placeholder}
            required={requerido}
            aria-label={placeholder}
            className="block w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
          />
          {q.length >= 2 && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-stone-100 bg-white">
              {coincidentes.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-stone-400">Ninguna persona coincide.</p>
              ) : (
                coincidentes.slice(0, 15).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSeleccion(p);
                      setTexto("");
                    }}
                    className="block w-full px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-50"
                  >
                    {p.nombre}
                    {p.detalle && <span className="block text-[11px] text-stone-400">{p.detalle}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
