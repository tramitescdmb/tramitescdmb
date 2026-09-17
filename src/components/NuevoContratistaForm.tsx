"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/Field";

export function NuevoContratistaForm() {
  const router = useRouter();
  const [identificacion, setIdentificacion] = useState("");
  const [tipoPersona, setTipoPersona] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [nombreORazonSocial, setNombreORazonSocial] = useState("");
  const [contactoEmail, setContactoEmail] = useState("");
  const [contactoTelefono, setContactoTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!identificacion.trim()) return setError("La identificación es obligatoria.");
    if (!nombreORazonSocial.trim()) return setError("El nombre o razón social es obligatorio.");
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/contratacion/contratistas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identificacion, tipoPersona, nombreORazonSocial, contactoEmail, contactoTelefono, direccion, ciudad }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setError(body.error);
        return;
      }
      if (!res.ok) throw new Error(body.error || "No se pudo crear el contratista.");
      router.push(`/contratacion/contratistas/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Identificación (NIT/cédula)" required>
          <input
            value={identificacion}
            onChange={(e) => setIdentificacion(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
        </Field>
        <Field label="Tipo">
          <select
            value={tipoPersona}
            onChange={(e) => setTipoPersona(e.target.value as "NATURAL" | "JURIDICA")}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          >
            <option value="NATURAL">Persona natural</option>
            <option value="JURIDICA">Persona jurídica</option>
          </select>
        </Field>
      </div>

      <Field label="Nombre o razón social" required>
        <input
          value={nombreORazonSocial}
          onChange={(e) => setNombreORazonSocial(e.target.value)}
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Correo electrónico">
          <input
            type="email"
            value={contactoEmail}
            onChange={(e) => setContactoEmail(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
        </Field>
        <Field label="Teléfono">
          <input
            value={contactoTelefono}
            onChange={(e) => setContactoTelefono(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Dirección">
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
        </Field>
        <Field label="Ciudad">
          <input
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between border-t border-stone-100 pt-4">
        <span className="text-sm text-red-700">{error}</span>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-md bg-cdmb-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-cdmb-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? "Creando…" : "Crear contratista"}
        </button>
      </div>
    </div>
  );
}
