"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Building2, Wallet, CalendarDays, UserCog, Search, UserPlus, Hash } from "lucide-react";
import { Field, SectionHelp } from "@/components/Field";
import { CampoMoneda } from "@/components/CampoMoneda";
import { BuscadorDependencia } from "@/components/BuscadorDependencia";

type Opcion = { id: string; nombre: string };
type SupervisorOpcion = { id: string; nombre: string; dependenciaNombre?: string | null };
type ModalidadOpcion = { valor: string; etiqueta: string };
type TipoPersona = "NATURAL" | "JURIDICA";

export function NuevoExpedienteContractualForm({
  dependencias,
  supervisores,
  modalidades,
}: {
  dependencias: Opcion[];
  supervisores: SupervisorOpcion[];
  modalidades: ModalidadOpcion[];
}) {
  const router = useRouter();
  const [objeto, setObjeto] = useState("");
  const [modalidadSeleccion, setModalidadSeleccion] = useState(modalidades[0]?.valor ?? "");
  const [valor, setValor] = useState("");
  const [numeroContrato, setNumeroContrato] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFinEstimada, setFechaFinEstimada] = useState("");
  const [dependenciaSolicitanteId, setDependenciaSolicitanteId] = useState("");
  const [supervisorUsuarioIds, setSupervisorUsuarioIds] = useState<Set<string>>(new Set());
  const [filtroSupervisor, setFiltroSupervisor] = useState("");
  const [dependenciaFiltroSupervisor, setDependenciaFiltroSupervisor] = useState("");

  const [contratistaIdentificacion, setContratistaIdentificacion] = useState("");
  const [contratistaId, setContratistaId] = useState<string | null>(null);
  const [contratistaNombre, setContratistaNombre] = useState<string | null>(null);
  const [buscandoContratista, setBuscandoContratista] = useState(false);
  const [contratistaNoEncontrado, setContratistaNoEncontrado] = useState(false);
  const [nuevoTipoPersona, setNuevoTipoPersona] = useState<TipoPersona>("NATURAL");
  const [nuevoNombreORazonSocial, setNuevoNombreORazonSocial] = useState("");
  const [creandoContratista, setCreandoContratista] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dependenciasSupervisor = Array.from(new Set(supervisores.map((s) => s.dependenciaNombre).filter((d): d is string => Boolean(d)))).sort();
  const qSupervisor = filtroSupervisor.trim().toLowerCase();
  // Igual que en los otros selectores de personas: solo se muestran pastillas una vez que se
  // busca por nombre o dependencia (además de las ya elegidas), para que la lista no crezca sin
  // control a medida que aumente el número de supervisores.
  const supervisoresFiltrados = supervisores.filter(
    (s) =>
      supervisorUsuarioIds.has(s.id) ||
      ((qSupervisor || dependenciaFiltroSupervisor) &&
        (!qSupervisor || s.nombre.toLowerCase().includes(qSupervisor)) &&
        (!dependenciaFiltroSupervisor || s.dependenciaNombre === dependenciaFiltroSupervisor))
  );

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
    setContratistaNoEncontrado(false);
    try {
      const res = await fetch(`/api/contratacion/contratistas/buscar?identificacion=${encodeURIComponent(contratistaIdentificacion.trim())}`);
      if (res.ok) {
        const c = await res.json();
        setContratistaId(c.id);
        setContratistaNombre(c.nombreORazonSocial);
      } else {
        setContratistaId(null);
        setContratistaNombre(null);
        setContratistaNoEncontrado(true);
      }
    } catch {
      setError("No se pudo consultar el registro de contratistas. Intente de nuevo.");
    } finally {
      setBuscandoContratista(false);
    }
  }

  async function crearContratista() {
    if (!nuevoNombreORazonSocial.trim()) return setError("Indique el nombre o razón social del contratista.");
    setCreandoContratista(true);
    setError(null);
    try {
      const res = await fetch("/api/contratacion/contratistas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identificacion: contratistaIdentificacion.trim(),
          tipoPersona: nuevoTipoPersona,
          nombreORazonSocial: nuevoNombreORazonSocial.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo crear el contratista.");
      setContratistaId(body.id);
      setContratistaNombre(nuevoNombreORazonSocial.trim());
      setContratistaNoEncontrado(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCreandoContratista(false);
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
          numeroContrato: numeroContrato.trim() || null,
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
        <Field label="N.º de contrato SECOP II" icon={<Hash className="h-4 w-4" />}>
          <input
            value={numeroContrato}
            onChange={(e) => setNumeroContrato(e.target.value)}
            placeholder="Ej. 045-2026"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
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
              setContratistaNoEncontrado(false);
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
              {contratistaNoEncontrado ? "Creado: " : "Encontrado: "}{contratistaNombre}
            </span>
          )}
        </div>

        {contratistaNoEncontrado && !contratistaId && (
          <div className="mt-2 space-y-2 rounded-md border border-amber-300 bg-amber-50/50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              No hay ningún contratista con esa identificación — créelo aquí, queda listo para este expediente.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={nuevoTipoPersona}
                onChange={(e) => setNuevoTipoPersona(e.target.value as TipoPersona)}
                className="rounded-md border border-stone-200 px-2.5 py-1.5 text-xs"
              >
                <option value="NATURAL">Persona natural</option>
                <option value="JURIDICA">Persona jurídica</option>
              </select>
              <input
                value={nuevoNombreORazonSocial}
                onChange={(e) => setNuevoNombreORazonSocial(e.target.value)}
                placeholder="Nombre o razón social"
                className="rounded-md border border-stone-200 px-2.5 py-1.5 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={crearContratista}
              disabled={creandoContratista}
              className="rounded-md bg-amber-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-900 disabled:opacity-50"
            >
              {creandoContratista ? "Creando…" : "Crear contratista"}
            </button>
          </div>
        )}
      </Field>

      {supervisores.length > 0 && (
        <Field label="Supervisor(es) / Interventor(es)" icon={<UserCog className="h-4 w-4" />}>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <input
              type="text"
              value={filtroSupervisor}
              onChange={(e) => setFiltroSupervisor(e.target.value)}
              placeholder="Buscar por nombre…"
              className="rounded-lg border border-stone-200 px-2 py-1.5 text-sm"
            />
            <select
              value={dependenciaFiltroSupervisor}
              onChange={(e) => setDependenciaFiltroSupervisor(e.target.value)}
              className="rounded-lg border border-stone-200 px-2 py-1.5 text-sm"
            >
              <option value="">Todas las dependencias</option>
              {dependenciasSupervisor.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          {!qSupervisor && !dependenciaFiltroSupervisor && supervisorUsuarioIds.size === 0 ? (
            <p className="text-xs text-stone-400">Escriba un nombre o elija una dependencia para buscar.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {supervisoresFiltrados.map((s) => {
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
          )}
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
