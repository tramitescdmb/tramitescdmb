"use client";

import { useState } from "react";
import { FUERA_DE_JURISDICCION } from "@/lib/municipios";

/**
 * Selector de municipio del tercero (remitente / destinatario / peticionario).
 * Los 13 de la jurisdicción de la CDMB en la lista; si el tercero está fuera, se
 * elige "Otro municipio…" y se escriben a mano el departamento y el municipio
 * para dejar el origen caracterizado (no solo "Fuera de la jurisdicción").
 * El padre guarda `municipio` (texto final) y `departamento` (solo si es de fuera).
 */
export function MunicipioSelectorTercero({
  municipios,
  municipio,
  departamento,
  onMunicipio,
  onDepartamento,
  inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm",
}: {
  municipios: string[];
  municipio: string;
  departamento: string;
  onMunicipio: (v: string) => void;
  onDepartamento: (v: string) => void;
  inputCls?: string;
}) {
  const enLista = municipios.includes(municipio) && municipio !== FUERA_DE_JURISDICCION;
  const [modoLibre, setModoLibre] = useState(municipio !== "" && !enLista);
  const opciones = municipios.filter((m) => m !== FUERA_DE_JURISDICCION);

  return (
    <div className="space-y-2">
      <select
        value={modoLibre ? "__otro__" : municipio}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__otro__") {
            setModoLibre(true);
            onMunicipio("");
          } else {
            setModoLibre(false);
            onDepartamento("");
            onMunicipio(v);
          }
        }}
        className={inputCls}
      >
        <option value="">— Sin especificar —</option>
        {opciones.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
        <option value="__otro__">Otro municipio (fuera de la jurisdicción)…</option>
      </select>

      {modoLibre && (
        <div className="grid grid-cols-1 gap-2 rounded-md border border-stone-200 bg-stone-50 p-2 sm:grid-cols-2">
          <label className="text-xs">
            <span className="mb-1 block font-medium text-stone-600">Departamento</span>
            <input
              value={departamento}
              onChange={(e) => onDepartamento(e.target.value)}
              placeholder="Ej. Antioquia"
              className={inputCls}
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-stone-600">Municipio</span>
            <input
              value={municipio}
              onChange={(e) => onMunicipio(e.target.value)}
              placeholder="Ej. Medellín"
              className={inputCls}
            />
          </label>
        </div>
      )}
    </div>
  );
}
