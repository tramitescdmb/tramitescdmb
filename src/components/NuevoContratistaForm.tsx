"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/Field";
import { REGIMENES_TRIBUTARIOS } from "@/lib/regimen-tributario";

const inputCls = "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

export function NuevoContratistaForm() {
  const router = useRouter();
  const [identificacion, setIdentificacion] = useState("");
  const [tipoPersona, setTipoPersona] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [regimenTributario, setRegimenTributario] = useState("");
  const [granContribuyente, setGranContribuyente] = useState(false);
  const [contactoEmail, setContactoEmail] = useState("");
  const [contactoTelefono, setContactoTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esJuridica = tipoPersona === "JURIDICA";

  async function guardar() {
    if (!identificacion.trim()) return setError("La identificación es obligatoria.");
    if (esJuridica ? !razonSocial.trim() : !nombres.trim() || !apellidos.trim()) {
      return setError(esJuridica ? "La razón social es obligatoria." : "Nombres y apellidos son obligatorios.");
    }
    setGuardando(true);
    setError(null);
    try {
      const nombreORazonSocial = esJuridica ? razonSocial.trim() : `${nombres.trim()} ${apellidos.trim()}`.trim();
      const res = await fetch("/api/contratacion/contratistas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identificacion,
          tipoPersona,
          nombres: esJuridica ? null : nombres,
          apellidos: esJuridica ? null : apellidos,
          nombreORazonSocial,
          regimenTributario,
          granContribuyente,
          contactoEmail,
          contactoTelefono,
          direccion,
          departamento,
          ciudad,
        }),
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
    <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Identificación (NIT/cédula)" required>
          <input value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Tipo">
          <select value={tipoPersona} onChange={(e) => setTipoPersona(e.target.value as "NATURAL" | "JURIDICA")} className={inputCls}>
            <option value="NATURAL">Persona natural</option>
            <option value="JURIDICA">Persona jurídica</option>
          </select>
        </Field>
      </div>

      {esJuridica ? (
        <Field label="Razón social" required>
          <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} className={inputCls} />
        </Field>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombres" required>
            <input value={nombres} onChange={(e) => setNombres(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Apellidos" required>
            <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} className={inputCls} />
          </Field>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Correo electrónico">
          <input type="email" value={contactoEmail} onChange={(e) => setContactoEmail(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Teléfono">
          <input value={contactoTelefono} onChange={(e) => setContactoTelefono(e.target.value)} className={inputCls} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Dirección">
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Departamento">
          <input value={departamento} onChange={(e) => setDepartamento(e.target.value)} placeholder="Ej. Santander" className={inputCls} />
        </Field>
        <Field label="Ciudad">
          <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Ej. Bucaramanga" className={inputCls} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Régimen tributario">
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
