"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NATURALEZAS } from "@/lib/negocios-verdes-ficha";
import { TIPOS_PERSONA, type TipoPersonaNV } from "@/lib/negocios-verdes-catalogo";
import { llamarNV } from "@/lib/negocios-verdes-cliente";

export type VinculoFila = {
  id: string;
  tipo: TipoPersonaNV;
  persona: string;
  nit: string | null;
  naturalezaJuridica: string | null;
  nota: string | null;
  desde: string;
  hasta: string | null;
};

const entrada = "w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm";
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric" });

/** Personas vinculadas a un negocio: vigentes por tipo, asignar, terminar e historial. */
export function VinculosNegocioNV({ negocioId, vinculos, personas, editable }: { negocioId: string; vinculos: VinculoFila[]; personas: { id: string; nombre: string; tipo: TipoPersonaNV }[]; editable: boolean }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoPersonaNV>("REPRESENTANTE");
  const [personaId, setPersonaId] = useState("");
  const [nit, setNit] = useState("");
  const [naturaleza, setNaturaleza] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);

  const vigentes = vinculos.filter((v) => !v.hasta);
  const historial = vinculos.filter((v) => v.hasta);
  const opciones = personas.filter((p) => p.tipo === tipo);

  async function ejecutar(fn: () => Promise<unknown>) {
    setOcupado(true);
    setError(null);
    try {
      await fn();
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function asignar(e: React.FormEvent) {
    e.preventDefault();
    if (!personaId) return;
    const ok = await ejecutar(() => llamarNV(`/api/negocios-verdes/negocios/${negocioId}/personas`, "POST", { personaId, tipo, nit, naturalezaJuridica: naturaleza, nota }));
    if (ok) {
      setPersonaId("");
      setNit("");
      setNaturaleza("");
      setNota("");
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="font-semibold text-stone-900">Personas vinculadas</h3>
      {vigentes.length === 0 ? (
        <p className="text-sm text-stone-500">Sin personas vigentes.</p>
      ) : (
        <ul className="divide-y divide-stone-100 text-sm">
          {vigentes.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="font-medium text-stone-800">{v.persona}</p>
                <p className="text-xs text-stone-500">
                  {TIPOS_PERSONA[v.tipo]} desde {fecha(v.desde)}
                  {v.nit ? ` · NIT ${v.nit}` : ""}
                  {v.naturalezaJuridica ? ` · ${v.naturalezaJuridica}` : ""}
                </p>
                {v.nota && <p className="text-xs text-stone-600">{v.nota}</p>}
              </div>
              {editable && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => window.confirm(`¿Terminar el vínculo de ${v.persona}? Quedará en el historial.`) && ejecutar(() => llamarNV(`/api/negocios-verdes/negocios/${negocioId}/personas?vinculo=${v.id}`, "DELETE"))}
                  className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  Terminar vínculo
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <form onSubmit={asignar} className="grid gap-2 rounded-lg bg-stone-50 p-3 sm:grid-cols-2">
          <label className="text-xs text-stone-600">
            Tipo
            <select value={tipo} onChange={(e) => { setTipo(e.target.value as TipoPersonaNV); setPersonaId(""); }} className={entrada}>
              {(Object.keys(TIPOS_PERSONA) as TipoPersonaNV[]).map((t) => (
                <option key={t} value={t}>{TIPOS_PERSONA[t]}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-stone-600">
            Persona
            <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} className={entrada} required>
              <option value="">Seleccione…</option>
              {opciones.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </label>
          {tipo === "REPRESENTANTE" && (
            <>
              <label className="text-xs text-stone-600">
                NIT
                <input value={nit} onChange={(e) => setNit(e.target.value)} maxLength={30} className={entrada} />
              </label>
              <label className="text-xs text-stone-600">
                Naturaleza jurídica
                <select value={naturaleza} onChange={(e) => setNaturaleza(e.target.value)} className={entrada}>
                  <option value="">Sin dato</option>
                  {NATURALEZAS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="text-xs text-stone-600 sm:col-span-2">
            Nota
            <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000} className={entrada} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={ocupado || !personaId} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
              Asignar
            </button>
            <span className="ml-2 text-xs text-stone-500">Si ya hay una persona vigente de ese tipo, su vínculo se cierra y pasa al historial.</span>
          </div>
        </form>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {historial.length > 0 && (
        <div>
          <button type="button" onClick={() => setVerHistorial(!verHistorial)} className="text-sm text-emerald-700 hover:underline">
            {verHistorial ? "Ocultar historial" : `Ver historial (${historial.length})`}
          </button>
          {verHistorial && (
            <ul className="mt-2 space-y-1 text-xs text-stone-600">
              {historial.map((v) => (
                <li key={v.id}>
                  {v.persona} · {TIPOS_PERSONA[v.tipo]} · {fecha(v.desde)} a {fecha(v.hasta!)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
