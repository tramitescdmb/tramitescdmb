"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/Field";
import { MUNICIPIOS_JURISDICCION_CDMB } from "@/lib/municipios";
import { REGIMENES_TRIBUTARIOS } from "@/lib/regimen-tributario";

type Solicitante = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  municipio: string | null;
  regimenTributario: string | null;
  granContribuyente: boolean;
};

export function EditarSolicitanteForm({ solicitante }: { solicitante: Solicitante }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(solicitante.nombre);
  const [email, setEmail] = useState(solicitante.email ?? "");
  const [telefono, setTelefono] = useState(solicitante.telefono ?? "");
  const [direccion, setDireccion] = useState(solicitante.direccion ?? "");
  const [municipio, setMunicipio] = useState(solicitante.municipio ?? "");
  const [regimenTributario, setRegimenTributario] = useState(solicitante.regimenTributario ?? "");
  const [granContribuyente, setGranContribuyente] = useState(solicitante.granContribuyente);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/solicitantes/${solicitante.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, telefono, direccion, municipio, regimenTributario, granContribuyente }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo guardar.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <details className="mt-3 group">
      <summary className="cursor-pointer text-xs font-medium text-cdmb-700 [&::-webkit-details-marker]:hidden">
        Editar datos
      </summary>
      <form onSubmit={guardar} className="mt-3 space-y-3 border-t border-stone-100 pt-3">
        <Field label="Nombre o razón social" required help="">
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Correo electrónico" help="">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
          </Field>
          <Field label="Teléfono" help="">
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Dirección" help="">
            <input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
          </Field>
          <Field label="Municipio" help="">
            <select
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            >
              <option value="">Sin especificar</option>
              {MUNICIPIOS_JURISDICCION_CDMB.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Régimen tributario" help="">
            <select
              value={regimenTributario}
              onChange={(e) => setRegimenTributario(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            >
              <option value="">Sin especificar</option>
              {REGIMENES_TRIBUTARIOS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={granContribuyente}
                onChange={(e) => setGranContribuyente(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-cdmb-600 focus:ring-cdmb-500"
              />
              Gran contribuyente
            </label>
          </div>
        </div>

        {error && <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </details>
  );
}
