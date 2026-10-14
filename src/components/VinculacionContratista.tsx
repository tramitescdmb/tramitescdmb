"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Check, X } from "lucide-react";

export function SolicitarVinculacion() {
  const [documento, setDocumento] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  async function enviar() {
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/contratacion/vinculacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documento }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo registrar la solicitud.");
      setMensaje({ ok: true, texto: `Solicitud enviada. La Oficina de Contratación confirmará su vínculo con ${body.contratista}; después verá aquí sus contratos.` });
    } catch (err) {
      setMensaje({ ok: false, texto: err instanceof Error ? err.message : "Error inesperado." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
        <Briefcase className="h-4 w-4 text-amber-700" aria-hidden />
        ¿Es contratista de la CDMB?
      </h2>
      <p className="mt-0.5 text-xs text-stone-600">Escriba su número de documento (cédula o NIT) para vincular su usuario con su contrato en GECON.</p>
      {mensaje?.ok ? (
        <p className="mt-2 text-xs text-emerald-800">{mensaje.texto}</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            inputMode="numeric"
            placeholder="Número de documento"
            className="w-48 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || documento.trim().length < 5}
            className="rounded-lg bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
          >
            {enviando ? "Enviando…" : "Solicitar vínculo"}
          </button>
          {mensaje && <span className="text-xs text-red-700">{mensaje.texto}</span>}
        </div>
      )}
    </section>
  );
}

export type SolicitudVinculacionFila = {
  id: string;
  documento: string;
  creada: string;
  usuario: { nombre: string; email: string; directorioActivo: boolean } | null;
  contratista: { nombreORazonSocial: string; identificacion: string } | null;
};

export function ConfirmarVinculaciones({ solicitudes }: { solicitudes: SolicitudVinculacionFila[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolver(id: string, aprobar: boolean) {
    setOcupado(id);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/vinculacion/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aprobar }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo resolver.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setOcupado(null);
    }
  }

  if (solicitudes.length === 0) return null;
  return (
    <section className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-stone-900">Vinculaciones por confirmar ({solicitudes.length})</h2>
      <p className="mt-0.5 text-xs text-stone-500">
        Personas que ingresaron con su usuario de red y declararon el documento de un contratista. Confirme solo si el usuario corresponde a esa
        persona.
      </p>
      <ul className="mt-2 divide-y divide-stone-100 text-xs">
        {solicitudes.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <strong className="text-stone-800">{s.usuario?.nombre ?? "Usuario"}</strong>
              <span className="text-stone-500">
                {" "}
                ({s.usuario?.email}
                {s.usuario?.directorioActivo ? ", directorio activo" : ""})
              </span>{" "}
              declara ser <strong className="text-stone-800">{s.contratista?.nombreORazonSocial}</strong> · documento {s.documento}
            </span>
            <span className="flex gap-1.5">
              <button
                type="button"
                disabled={ocupado === s.id}
                onClick={() => resolver(s.id, true)}
                className="inline-flex items-center gap-1 rounded-md bg-cdmb-600 px-2.5 py-1 font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                Confirmar
              </button>
              <button
                type="button"
                disabled={ocupado === s.id}
                onClick={() => resolver(s.id, false)}
                className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1 font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Rechazar
              </button>
            </span>
          </li>
        ))}
      </ul>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </section>
  );
}
