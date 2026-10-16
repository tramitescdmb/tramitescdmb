"use client";

import { useState } from "react";
import { TIPOS_ACTO_ADMINISTRATIVO, componerActo, descomponerActo, errorPartesActo, type PartesActoAdministrativo } from "@/lib/acto-administrativo";

const CLASE = "mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";

export function CampoActoAdministrativo({
  valorInicial,
  onChange,
}: {
  valorInicial: string | null;
  onChange: (valor: string | null, error: string | null) => void;
}) {
  const [partes, setPartes] = useState<PartesActoAdministrativo>(() => descomponerActo(valorInicial));
  const error = errorPartesActo(partes);

  function cambiar(campo: keyof PartesActoAdministrativo, valor: string) {
    const siguiente = { ...partes, [campo]: valor };
    if (campo === "tipo" && !valor) Object.assign(siguiente, { numero: "", anio: "" });
    setPartes(siguiente);
    onChange(componerActo(siguiente), errorPartesActo(siguiente));
  }

  return (
    <fieldset className="text-xs font-medium text-stone-600">
      <legend>
        Acto administrativo del cargo <span className="font-normal text-stone-400">(opcional)</span>
      </legend>
      <div className="grid max-w-md grid-cols-[1.4fr_1fr_0.8fr] gap-2">
        <label className="block">
          <span className="sr-only">Tipo de acto</span>
          <select value={partes.tipo} onChange={(e) => cambiar("tipo", e.target.value)} className={CLASE} aria-label="Tipo de acto administrativo">
            <option value="">— Sin acto —</option>
            {TIPOS_ACTO_ADMINISTRATIVO.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Número</span>
          <input
            value={partes.numero}
            onChange={(e) => cambiar("numero", e.target.value.replace(/\s/g, ""))}
            disabled={!partes.tipo}
            maxLength={15}
            inputMode="numeric"
            placeholder="Número"
            aria-label="Número del acto administrativo"
            className={`${CLASE} disabled:bg-stone-50`}
          />
        </label>
        <label className="block">
          <span className="sr-only">Año</span>
          <input
            value={partes.anio}
            onChange={(e) => cambiar("anio", e.target.value.replace(/\D/g, "").slice(0, 4))}
            disabled={!partes.tipo}
            inputMode="numeric"
            placeholder="Año"
            aria-label="Año del acto administrativo"
            className={`${CLASE} disabled:bg-stone-50`}
          />
        </label>
      </div>
      <span className={`mt-0.5 block text-[11px] font-normal ${error ? "text-red-700" : "text-stone-400"}`}>
        {error ?? "Nombramiento o encargo. Si se diligencia, aparece en la firma debajo del cargo."}
      </span>
    </fieldset>
  );
}
