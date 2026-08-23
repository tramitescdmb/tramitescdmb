"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Field } from "@/components/Field";
import { Spinner } from "@/components/Spinner";
import { MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION } from "@/lib/municipios";
import { REGIMENES_TRIBUTARIOS } from "@/lib/regimen-tributario";
import { IconUser, IconIdCard, IconMail, IconPhone, IconMapPin, IconBriefcase } from "@/components/icons";

const iconSm = "h-4 w-4";

export function NuevoSolicitanteForm() {
  const router = useRouter();
  const [tipo, setTipo] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const esJuridica = tipo === "JURIDICA";
  const [identificacion, setIdentificacion] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [regimenTributario, setRegimenTributario] = useState("");
  const [granContribuyente, setGranContribuyente] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<{ texto: string; idExistente?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!identificacion.trim()) {
      setError({ texto: "Debe indicarse la identificación." });
      return;
    }
    if (esJuridica ? !razonSocial.trim() : !nombres.trim() || !apellidos.trim()) {
      setError({ texto: esJuridica ? "Debe indicarse la razón social." : "Deben indicarse los nombres y apellidos." });
      return;
    }
    if (!municipio) {
      setError({ texto: 'Debe seleccionarse el municipio (o la opción "Fuera de la jurisdicción" si no aplica).' });
      return;
    }

    setGuardando(true);
    try {
      const res = await fetch("/api/solicitantes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          identificacion,
          nombres,
          apellidos,
          razonSocial,
          email,
          telefono,
          direccion,
          municipio,
          regimenTributario,
          granContribuyente,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        setError({ texto: "Ya existe un solicitante registrado con esta identificación.", idExistente: data.id });
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "No se pudo crear el solicitante.");
      }

      router.push(`/solicitantes/${data.id}`);
    } catch (err) {
      setError({ texto: err instanceof Error ? err.message : "Ocurrió un error inesperado. Intente nuevamente." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
      <Field label="Tipo de solicitante" required icon={<IconUser className={iconSm} />} help="Defina si corresponde a persona natural o a empresa/entidad. Esta selección determina si se solicita cédula o NIT.">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as "NATURAL" | "JURIDICA")}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        >
          <option value="NATURAL">Persona natural</option>
          <option value="JURIDICA">Persona jurídica (empresa, entidad)</option>
        </select>
      </Field>

      <Field
        label={esJuridica ? "NIT" : "Cédula de ciudadanía"}
        required
        icon={<IconIdCard className={iconSm} />}
        help="No puede repetirse. Si ya existe un solicitante registrado con este número, se notificará en lugar de crear un registro duplicado."
      >
        <input
          required
          value={identificacion}
          onChange={(e) => setIdentificacion(e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          placeholder={esJuridica ? "Ej: 900123456-1" : "Ej: 91234567"}
        />
      </Field>

      {esJuridica ? (
        <Field label="Razón social" required icon={<IconUser className={iconSm} />} help="Nombre legal de la empresa o entidad.">
          <input
            required
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            placeholder="Ej: Industrias ABC S.A.S."
          />
        </Field>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombres" required icon={<IconUser className={iconSm} />} help="">
            <input
              required
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              placeholder="Ej: Juan Pérez"
            />
          </Field>
          <Field label="Apellidos" required icon={<IconUser className={iconSm} />} help="">
            <input
              required
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              placeholder="Ej: Gómez Rodríguez"
            />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Correo electrónico" icon={<IconMail className={iconSm} />} help="">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            placeholder="correo@ejemplo.com"
          />
        </Field>
        <Field label="Teléfono" icon={<IconPhone className={iconSm} />} help="">
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            placeholder="Ej: 3001234567"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Dirección" icon={<IconMapPin className={iconSm} />} help="">
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
        </Field>
        <Field label="Municipio" required icon={<IconMapPin className={iconSm} />} help="">
          <select
            required
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          >
            <option value="" disabled>
              Seleccione un municipio…
            </option>
            <option value={FUERA_DE_JURISDICCION}>{FUERA_DE_JURISDICCION}</option>
            {MUNICIPIOS_JURISDICCION_CDMB.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Régimen tributario (opcional)"
          icon={<IconBriefcase className={iconSm} />}
          help="Para aplicar correctamente retenciones, beneficios o estampillas si la CDMB llega a pagarle a este solicitante."
        >
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

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.texto}
          {error.idExistente && (
            <>
              {" "}
              <Link href={`/solicitantes/${error.idExistente}`} className="font-medium underline">
                Ver el registro existente →
              </Link>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href="/solicitantes" className="text-sm text-stone-500 hover:text-stone-700">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={guardando}
          className="flex items-center gap-2 rounded-md bg-cdmb-600 px-5 py-2 text-sm font-medium text-white transition-transform hover:bg-cdmb-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
        >
          {guardando && <Spinner claro />}
          {guardando ? "Guardando…" : "Crear solicitante"}
        </button>
      </div>
    </form>
  );
}
