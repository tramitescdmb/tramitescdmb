"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/Field";
import { Spinner } from "@/components/Spinner";
import { REGIMENES_TRIBUTARIOS } from "@/lib/regimen-tributario";

const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

type Contratista = {
  id: string;
  tipoPersona: string;
  nombres: string | null;
  apellidos: string | null;
  nombreORazonSocial: string;
  regimenTributario: string | null;
  granContribuyente: boolean;
  contactoEmail: string | null;
  contactoTelefono: string | null;
  direccion: string | null;
  departamento: string | null;
  ciudad: string | null;
};

export function EditarContratistaForm({ contratista }: { contratista: Contratista }) {
  const router = useRouter();
  const esJuridica = contratista.tipoPersona === "JURIDICA";
  const [nombres, setNombres] = useState(contratista.nombres ?? "");
  const [apellidos, setApellidos] = useState(contratista.apellidos ?? "");
  const [nombreORazonSocial, setNombreORazonSocial] = useState(contratista.nombreORazonSocial);
  const [regimenTributario, setRegimenTributario] = useState(contratista.regimenTributario ?? "");
  const [granContribuyente, setGranContribuyente] = useState(contratista.granContribuyente);
  const [contactoEmail, setContactoEmail] = useState(contratista.contactoEmail ?? "");
  const [contactoTelefono, setContactoTelefono] = useState(contratista.contactoTelefono ?? "");
  const [direccion, setDireccion] = useState(contratista.direccion ?? "");
  const [departamento, setDepartamento] = useState(contratista.departamento ?? "");
  const [ciudad, setCiudad] = useState(contratista.ciudad ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const nombreOFinal = esJuridica ? nombreORazonSocial : `${nombres.trim()} ${apellidos.trim()}`.trim();
      const res = await fetch(`/api/contratacion/contratistas/${contratista.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombres: esJuridica ? null : nombres,
          apellidos: esJuridica ? null : apellidos,
          nombreORazonSocial: nombreOFinal,
          regimenTributario,
          granContribuyente,
          contactoEmail,
          contactoTelefono,
          direccion,
          departamento,
          ciudad,
        }),
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
        {esJuridica ? (
          <Field label="Razón social" required help="">
            <input required value={nombreORazonSocial} onChange={(e) => setNombreORazonSocial(e.target.value)} className={inputCls} />
          </Field>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombres" required help="">
              <input required value={nombres} onChange={(e) => setNombres(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Apellidos" required help="">
              <input required value={apellidos} onChange={(e) => setApellidos(e.target.value)} className={inputCls} />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Correo electrónico" help="">
            <input type="email" value={contactoEmail} onChange={(e) => setContactoEmail(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Teléfono" help="">
            <input value={contactoTelefono} onChange={(e) => setContactoTelefono(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Dirección" help="">
            <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Departamento" help="">
            <input value={departamento} onChange={(e) => setDepartamento(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Ciudad" help="">
            <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Régimen tributario" help="">
            <select value={regimenTributario} onChange={(e) => setRegimenTributario(e.target.value)} className={inputCls}>
              <option value="">Sin especificar</option>
              {REGIMENES_TRIBUTARIOS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={granContribuyente} onChange={(e) => setGranContribuyente(e.target.checked)} className="h-4 w-4 rounded border-stone-200 text-cdmb-600 focus:ring-cdmb-500" />
              Gran contribuyente
            </label>
          </div>
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
