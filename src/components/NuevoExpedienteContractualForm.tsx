"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Building2, Wallet, CalendarDays, UserCog, Search } from "lucide-react";
import { Field, SectionHelp } from "@/components/Field";
import { CampoMoneda } from "@/components/CampoMoneda";
import { BuscadorDependencia } from "@/components/BuscadorDependencia";

type Opcion = { id: string; nombre: string };
type ModalidadOpcion = { valor: string; etiqueta: string };

export function NuevoExpedienteContractualForm({
  dependencias,
  supervisores,
  modalidades,
}: {
  dependencias: Opcion[];
  supervisores: Opcion[];
  modalidades: ModalidadOpcion[];
}) {
  const router = useRouter();
  const [objeto, setObjeto] = useState("");
  const [modalidadSeleccion, setModalidadSeleccion] = useState(modalidades[0]?.valor ?? "");
  const [valor, setValor] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFinEstimada, setFechaFinEstimada] = useState("");
  const [dependenciaSolicitanteId, setDependenciaSolicitanteId] = useState("");
  const [supervisorUsuarioIds, setSupervisorUsuarioIds] = useState<Set<string>>(new Set());

  const [contratistaIdentificacion, setContratistaIdentificacion] = useState("");
  const [contratistaId, setContratistaId] = useState<string | null>(null);
  const [contratistaNombre, setContratistaNombre] = useState<string | null>(null);
  const [buscandoContratista, setBuscandoContratista] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function alternarSupervisor(id: string) {
    setSupervisorUsuarioIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function buscarContratista() {
    if (!contratistaIdentificacion.trim()) return;
    setBuscandoContratista(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/contratistas/buscar?identificacion=${encodeURIComponent(contratistaIdentificacion.trim())}`);
      if (res.ok) {
        const c = await res.json();
        setContratistaId(c.id);
        setContratistaNombre(c.nombreORazonSocial);
      } else {
        setContratistaId(null);
        setContratistaNombre(null);
      }
    } finally {
      setBuscandoContratista(false);
    }
  }

  async function guardar() {
    if (!objeto.trim()) return setError("El objeto del contrato es obligatorio.");
    if (!dependenciaSolicitanteId) return setError("Debe elegir la dependencia solicitante.");
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/contratacion/expedientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objeto: objeto.trim(),
          modalidadSeleccion,
          valor: valor ? Number(valor) : null,
          fechaInicio: fechaInicio || null,
          fechaFinEstimada: fechaFinEstimada || null,
          dependenciaSolicitanteId,
          contratistaId,
          supervisorUsuarioIds: Array.from(supervisorUsuarioIds),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo crear el expediente.");
      router.push(`/contratacion/expedientes/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <SectionHelp>
        Abre el expediente en la etapa Precontractual. El objeto, la modalidad y los datos del contrato son
        informativos — este módulo gestiona el expediente y el flujo documental, no reemplaza SECOP II ni valida
        cuantías o reglas jurídicas de la modalidad elegida.
      </SectionHelp>

      <Field label="Objeto del contrato" required icon={<FileText className="h-4 w-4" />}>
        <textarea
          value={objeto}
          onChange={(e) => setObjeto(e.target.value)}
          rows={3}
          placeholder="Descripción del objeto a contratar"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Modalidad de selección" required>
          <select
            value={modalidadSeleccion}
            onChange={(e) => setModalidadSeleccion(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          >
            {modalidades.map((m) => (
              <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
            ))}
          </select>
        </Field>
        <Field label="Dependencia solicitante" required icon={<Building2 className="h-4 w-4" />}>
          <BuscadorDependencia dependencias={dependencias} value={dependenciaSolicitanteId} onChange={setDependenciaSolicitanteId} />
        </Field>
        <Field label="Valor del contrato" icon={<Wallet className="h-4 w-4" />} help="Opcional, en pesos colombianos.">
          <CampoMoneda value={valor} onChange={setValor} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Fecha de inicio" icon={<CalendarDays className="h-4 w-4" />}>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
          </Field>
          <Field label="Fin estimado">
            <input
              type="date"
              value={fechaFinEstimada}
              onChange={(e) => setFechaFinEstimada(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
          </Field>
        </div>
      </div>

      <Field
        label="Contratista"
        icon={<Search className="h-4 w-4" />}
        help="Opcional en esta etapa: en Precontractual todavía puede no estar definido. Búsquelo por NIT/cédula si ya se conoce."
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={contratistaIdentificacion}
            onChange={(e) => {
              setContratistaIdentificacion(e.target.value);
              setContratistaId(null);
              setContratistaNombre(null);
            }}
            placeholder="NIT o cédula"
            className="w-48 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
          <button
            type="button"
            onClick={buscarContratista}
            disabled={buscandoContratista || !contratistaIdentificacion.trim()}
            className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            {buscandoContratista ? "Buscando…" : "Buscar"}
          </button>
          {contratistaId && contratistaNombre && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              Encontrado: {contratistaNombre}
            </span>
          )}
          {!contratistaId && contratistaIdentificacion.trim() && !buscandoContratista && (
            <span className="text-xs text-stone-400">No registrado — puede vincularse después desde el expediente.</span>
          )}
        </div>
      </Field>

      {supervisores.length > 0 && (
        <Field
          label="Supervisor(es) / Interventor(es)"
          icon={<UserCog className="h-4 w-4" />}
          help="El Manual permite designar más de uno por contrato."
        >
          <div className="flex flex-wrap gap-1.5">
            {supervisores.map((s) => {
              const activo = supervisorUsuarioIds.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => alternarSupervisor(s.id)}
                  aria-pressed={activo}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    activo ? "border-cdmb-600 bg-cdmb-600 text-white" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {s.nombre}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      <div className="flex items-center justify-between border-t border-stone-100 pt-4">
        <span className="text-sm text-red-700">{error}</span>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-md bg-cdmb-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-cdmb-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? "Creando…" : "Crear expediente"}
        </button>
      </div>
    </div>
  );
}
