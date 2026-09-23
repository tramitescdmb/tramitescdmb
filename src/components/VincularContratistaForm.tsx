"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus } from "lucide-react";

type TipoPersona = "NATURAL" | "JURIDICA";

/** Vincula el contratista de un expediente ya creado — necesario para poder pasar de
 * Precontractual a Contractual (el expediente no puede avanzar sin saber quién es el
 * contratista, persona natural o jurídica). Busca por identificación; si no existe en el
 * registro de Contratistas (base propia de este módulo, separada de Solicitante de Trámites
 * ambientales 2.0 — no comparten NITs), permite crearlo aquí mismo y lo vincula de una vez,
 * mismo espíritu que "Buscar" en Nuevo expediente de Trámites 2.0.
 *
 * `contratistaActual`: cuando el expediente YA tiene un contratista vinculado, este mismo
 * formulario sirve para CAMBIARLO (pedido explícito del usuario, 2026-09-23 — antes la norma era
 * "un contratista por expediente, nunca se reemplaza"; un error de captura ya no exige borrar el
 * expediente completo) — pide confirmación antes de vincular, porque reemplaza a quien tenía
 * acceso al expediente y sus documentos. */
export function VincularContratistaForm({ expedienteId, contratistaActual }: { expedienteId: string; contratistaActual?: { nombreORazonSocial: string } | null }) {
  const router = useRouter();
  const [identificacion, setIdentificacion] = useState("");
  const [encontrado, setEncontrado] = useState<{ id: string; nombreORazonSocial: string } | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [tipoPersona, setTipoPersona] = useState<TipoPersona>("NATURAL");
  const [nombreORazonSocial, setNombreORazonSocial] = useState("");
  const [contactoEmail, setContactoEmail] = useState("");
  const [contactoTelefono, setContactoTelefono] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscar() {
    if (!identificacion.trim()) return;
    setBuscando(true);
    setError(null);
    setEncontrado(null);
    setNoEncontrado(false);
    try {
      const res = await fetch(`/api/contratacion/contratistas/buscar?identificacion=${encodeURIComponent(identificacion.trim())}`);
      if (res.ok) setEncontrado(await res.json());
      else setNoEncontrado(true);
    } finally {
      setBuscando(false);
    }
  }

  async function vincularId(id: string, nombre: string) {
    if (contratistaActual && !window.confirm(`¿Cambiar el contratista de «${contratistaActual.nombreORazonSocial}» a «${nombre}»? El anterior deja de tener acceso a este expediente.`)) {
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contratistaId: id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo vincular el contratista.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  async function crearYVincular() {
    if (!nombreORazonSocial.trim()) return setError("Indique el nombre o razón social.");
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/contratacion/contratistas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identificacion: identificacion.trim(),
          tipoPersona,
          nombreORazonSocial: nombreORazonSocial.trim(),
          contactoEmail,
          contactoTelefono,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo crear el contratista.");
      await vincularId(body.id, nombreORazonSocial.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setGuardando(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {contratistaActual && (
        <p className="text-[11px] text-amber-700">
          Contratista actual: <strong>{contratistaActual.nombreORazonSocial}</strong>. Buscar y vincular otro lo reemplaza.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={identificacion}
          onChange={(e) => {
            setIdentificacion(e.target.value);
            setEncontrado(null);
            setNoEncontrado(false);
          }}
          placeholder="NIT o cédula del contratista"
          className="w-52 rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        />
        <button
          type="button"
          onClick={buscar}
          disabled={buscando || !identificacion.trim()}
          className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
        >
          <Search className="h-3 w-3" aria-hidden />
          Buscar
        </button>
        {encontrado && (
          <>
            <span className="text-xs font-medium text-amber-900">{encontrado.nombreORazonSocial}</span>
            <button
              type="button"
              onClick={() => vincularId(encontrado.id, encontrado.nombreORazonSocial)}
              disabled={guardando}
              className="rounded-md bg-amber-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-900 disabled:opacity-50"
            >
              {guardando ? "Vinculando…" : contratistaActual ? "Cambiar" : "Vincular"}
            </button>
          </>
        )}
      </div>

      {noEncontrado && (
        <div className="space-y-2 rounded-md border border-amber-300 bg-white p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
            <UserPlus className="h-3.5 w-3.5" aria-hidden />
            No hay ningún contratista con esa identificación — créelo aquí y quedará vinculado de una vez.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={tipoPersona}
              onChange={(e) => setTipoPersona(e.target.value as TipoPersona)}
              className="rounded-md border border-stone-200 px-2.5 py-1.5 text-xs"
            >
              <option value="NATURAL">Persona natural</option>
              <option value="JURIDICA">Persona jurídica</option>
            </select>
            <input
              value={nombreORazonSocial}
              onChange={(e) => setNombreORazonSocial(e.target.value)}
              placeholder="Nombre o razón social"
              className="rounded-md border border-stone-200 px-2.5 py-1.5 text-xs"
            />
            <input
              value={contactoEmail}
              onChange={(e) => setContactoEmail(e.target.value)}
              placeholder="Correo electrónico"
              className="rounded-md border border-stone-200 px-2.5 py-1.5 text-xs"
            />
            <input
              value={contactoTelefono}
              onChange={(e) => setContactoTelefono(e.target.value)}
              placeholder="Teléfono"
              className="rounded-md border border-stone-200 px-2.5 py-1.5 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={crearYVincular}
            disabled={guardando}
            className="rounded-md bg-amber-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-900 disabled:opacity-50"
          >
            {guardando ? "Creando…" : "Crear y vincular"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
