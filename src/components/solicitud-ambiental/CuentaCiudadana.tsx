"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Loader2, LogOut, Save } from "lucide-react";
import { Field } from "@/components/Field";

const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";
const botonCls =
  "inline-flex items-center gap-2 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60";

async function enviar(url: string, datos: unknown): Promise<Record<string, unknown>> {
  const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos ?? {}) });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error((data as { error?: string }).error || "No se pudo completar la acción.");
  return data;
}

/** Primer ingreso: cédula o NIT, nombre, teléfono y autorización de datos. */
export function CompletarPerfilForm({ correo, siguiente }: { correo: string; siguiente?: string | null }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [identificacion, setIdentificacion] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esJuridica = tipo === "JURIDICA";

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    try {
      await enviar("/api/solicitud-ambiental/cuenta/perfil", { tipo, identificacion, nombre, telefono, aceptaTratamiento: acepta });
      if (siguiente) router.replace(siguiente);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Complete su registro</h2>
        <p className="mt-1 text-sm text-stone-600">
          Ingresó con <strong>{correo}</strong>. Indique a nombre de quién radica: verá aquí las solicitudes de esa cédula o NIT.
        </p>
      </div>
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
      <div className="flex gap-4 text-sm">
        {(["NATURAL", "JURIDICA"] as const).map((t) => (
          <label key={t} className="flex items-center gap-2">
            <input type="radio" name="tipo" checked={tipo === t} onChange={() => setTipo(t)} />
            {t === "NATURAL" ? "Persona natural" : "Persona jurídica (empresa)"}
          </label>
        ))}
      </div>
      <Field label={esJuridica ? "NIT" : "Cédula"} required help="No se puede cambiar después. Escríbalo solo con números.">
        <input value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} className={inputCls} inputMode="numeric" maxLength={20} />
      </Field>
      <Field label={esJuridica ? "Razón social" : "Nombre completo"} required>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} maxLength={200} autoComplete={esJuridica ? "organization" : "name"} />
      </Field>
      <Field label="Teléfono o celular">
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputCls} inputMode="tel" maxLength={40} autoComplete="tel" />
      </Field>
      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1" />
        <span>
          Autorizo a la CDMB a tratar mis datos personales para gestionar mis solicitudes y comunicarme sus novedades, conforme a la Ley 1581
          de 2012.
        </span>
      </label>
      <button type="submit" disabled={ocupado} className={botonCls}>
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
        Guardar y continuar
      </button>
    </form>
  );
}

/** Agrega a la cuenta una solicitud radicada antes, con el número que recibió. */
export function VincularSolicitudForm() {
  const router = useRouter();
  const [numero, setNumero] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vincular(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!numero.trim()) return setError("Escriba el número de solicitud.");
    setOcupado(true);
    try {
      await enviar("/api/solicitud-ambiental/cuenta/vincular", { numeroSolicitud: numero });
      setNumero("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={vincular} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
      <h2 className="text-sm font-semibold text-stone-800">¿Radicó antes sin cuenta?</h2>
      <p className="mt-1 text-xs text-stone-500">Escriba el número de solicitud que recibió (por ejemplo SL-7KQ4-M9XD) para verla aquí.</p>
      {error && <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value.toUpperCase())}
          className={`${inputCls} max-w-[14rem] font-mono`}
          placeholder="SL-XXXX-XXXX"
          autoComplete="off"
          aria-label="Número de solicitud"
        />
        <button type="submit" disabled={ocupado} className={botonCls}>
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
          Agregar
        </button>
      </div>
    </form>
  );
}

export function BotonSalirCiudadano({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={async () => {
        setOcupado(true);
        await fetch("/api/solicitud-ambiental/cuenta/salir", { method: "POST" }).catch(() => {});
        router.replace("/solicitud-ambiental");
        router.refresh();
      }}
      className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition bg-white/15 text-white ring-1 ring-white/40 hover:bg-white/25 ${className}`}
    >
      <LogOut className="h-4 w-4" aria-hidden /> Salir
    </button>
  );
}

export function EnlaceIngresar({ siguiente }: { siguiente?: string }) {
  return (
    <Link
      href={siguiente ? `/solicitud-ambiental/ingresar?siguiente=${encodeURIComponent(siguiente)}` : "/solicitud-ambiental/ingresar"}
      className="font-semibold text-cdmb-700 underline hover:no-underline"
    >
      Ingrese con su correo
    </Link>
  );
}
