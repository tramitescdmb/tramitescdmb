"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/Field";
import { Spinner } from "@/components/Spinner";

type Contratista = {
  id: string;
  nombreORazonSocial: string;
  contactoEmail: string | null;
  contactoTelefono: string | null;
  direccion: string | null;
  ciudad: string | null;
};

export function EditarContratistaForm({ contratista }: { contratista: Contratista }) {
  const router = useRouter();
  const [nombreORazonSocial, setNombreORazonSocial] = useState(contratista.nombreORazonSocial);
  const [contactoEmail, setContactoEmail] = useState(contratista.contactoEmail ?? "");
  const [contactoTelefono, setContactoTelefono] = useState(contratista.contactoTelefono ?? "");
  const [direccion, setDireccion] = useState(contratista.direccion ?? "");
  const [ciudad, setCiudad] = useState(contratista.ciudad ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/contratistas/${contratista.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombreORazonSocial, contactoEmail, contactoTelefono, direccion, ciudad }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo guardar.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado. Intente nuevamente.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <details className="mt-3 group">
      <summary className="cursor-pointer text-xs font-medium text-cdmb-700 [&::-webkit-details-marker]:hidden">
        Editar información
      </summary>
      <form onSubmit={guardar} className="mt-3 space-y-3 border-t border-stone-100 pt-3">
        <Field label="Nombre o razón social" required help="">
          <input
            required
            value={nombreORazonSocial}
            onChange={(e) => setNombreORazonSocial(e.target.value)}
            className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Correo electrónico" help="">
            <input
              type="email"
              value={contactoEmail}
              onChange={(e) => setContactoEmail(e.target.value)}
              className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
          </Field>
          <Field label="Teléfono" help="">
            <input
              value={contactoTelefono}
              onChange={(e) => setContactoTelefono(e.target.value)}
              className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Dirección" help="">
            <input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
          </Field>
          <Field label="Ciudad" help="">
            <input
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
          </Field>
        </div>

        {error && <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={guardando}
          className="flex items-center gap-2 rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white transition-transform hover:bg-cdmb-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
        >
          {guardando && <Spinner claro />}
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </details>
  );
}
