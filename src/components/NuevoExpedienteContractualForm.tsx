"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ClipboardList,
  FileText,
  Building2,
  CircleDollarSign,
  CalendarRange,
  Hash,
  UserSearch,
  UserPlus,
  Users,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Field } from "@/components/Field";
import { CampoMoneda } from "@/components/CampoMoneda";
import { BuscadorDependencia } from "@/components/BuscadorDependencia";

type Opcion = { id: string; nombre: string };
type SupervisorOpcion = { id: string; nombre: string; dependenciaNombre?: string | null };
type ModalidadOpcion = { valor: string; etiqueta: string };
type TipoPersona = "NATURAL" | "JURIDICA";

const campoCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 " +
  "transition-shadow focus:border-cdmb-500 focus:outline-none focus:ring-4 focus:ring-cdmb-500/15";

function SeccionFormulario({
  n,
  icon: Icon,
  titulo,
  subtitulo,
  tono = "cdmb",
  children,
}: {
  n: number;
  icon: typeof FileText;
  titulo: string;
  subtitulo?: string;
  tono?: "cdmb" | "techblue";
  children: ReactNode;
}) {
  const insignia = tono === "techblue" ? "bg-techblue-600" : "bg-cdmb-600";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg text-xs font-bold text-white ${insignia}`}>{n}</span>
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
            <Icon className="h-4 w-4 text-stone-400" aria-hidden />
            {titulo}
          </h2>
          {subtitulo && <p className="text-xs text-stone-500">{subtitulo}</p>}
        </div>
      </div>
      <div className="space-y-2.5 pl-9">{children}</div>
    </div>
  );
}

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
      if (res.status === 409 && body.id) {
        await buscarContratista();
        return;
      }
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

  const nuevoContratistaHref = `/contratacion/contratistas/nuevo${
    contratistaIdentificacion.trim() ? `?identificacion=${encodeURIComponent(contratistaIdentificacion.trim())}` : ""
  }`;

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-soft-lg">
      <div className="flex items-center gap-2.5 border-b border-stone-100 bg-gradient-to-br from-cdmb-50/70 to-white px-5 py-3.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-cdmb-600 text-white">
          <FileText className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-xs leading-snug text-stone-600">
          Abre el expediente en <strong className="text-stone-800">Precontractual</strong> — datos informativos, no reemplaza SECOP II.
        </p>
      </div>

      <div className="space-y-5 px-6 py-5">
        <SeccionFormulario n={1} icon={ClipboardList} titulo="Información del contrato">
            <Field label="Objeto del contrato" required icon={<FileText className="h-4 w-4" />}>
              <textarea
                value={objeto}
                onChange={(e) => setObjeto(e.target.value)}
                rows={3}
                placeholder="Descripción del objeto a contratar"
                className={campoCls}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Modalidad de selección" required>
                <select value={modalidadSeleccion} onChange={(e) => setModalidadSeleccion(e.target.value)} className={campoCls}>
                  {modalidades.map((m) => (
                    <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
                  ))}
                </select>
              </Field>
              <Field label="Dependencia solicitante" required icon={<Building2 className="h-4 w-4" />}>
                <BuscadorDependencia dependencias={dependencias} value={dependenciaSolicitanteId} onChange={setDependenciaSolicitanteId} />
              </Field>
            </div>
          </SeccionFormulario>

          <div className="border-t border-dashed border-stone-100" />

          <SeccionFormulario n={2} icon={CircleDollarSign} titulo="Presupuesto y plazo" subtitulo="Opcional.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Valor del contrato" icon={<CircleDollarSign className="h-4 w-4" />} help="En pesos colombianos.">
                <CampoMoneda value={valor} onChange={setValor} className="rounded-xl" />
              </Field>
              <Field label="N.º de contrato SECOP II" icon={<Hash className="h-4 w-4" />}>
                <input
                  value={numeroContrato}
                  onChange={(e) => setNumeroContrato(e.target.value)}
                  placeholder="Ej. 045-2026"
                  className={campoCls}
                />
              </Field>
              <Field label="Fecha de inicio" icon={<CalendarRange className="h-4 w-4" />}>
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={campoCls} />
              </Field>
              <Field label="Fin estimado">
                <input type="date" value={fechaFinEstimada} onChange={(e) => setFechaFinEstimada(e.target.value)} className={campoCls} />
              </Field>
            </div>
          </SeccionFormulario>

          <div className="border-t border-dashed border-stone-100" />

          <SeccionFormulario
            n={3}
            icon={UserSearch}
            titulo="Contratista"
            subtitulo="Opcional en esta etapa."
            tono="techblue"
          >
            <div className="rounded-xl border border-techblue-100 bg-techblue-50/40 p-3.5">
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
                  className={`${campoCls} w-36 bg-white`}
                />
                <button
                  type="button"
                  onClick={buscarContratista}
                  disabled={buscandoContratista || !contratistaIdentificacion.trim()}
                  className="rounded-xl border border-techblue-200 bg-white px-3 py-2.5 text-xs font-medium text-techblue-700 transition hover:bg-techblue-50 disabled:opacity-50"
                >
                  {buscandoContratista ? "Buscando…" : "Buscar"}
                </button>
                <Link
                  href={nuevoContratistaHref}
                  target="_blank"
                  rel="noreferrer"
                  title="Abre el registro completo de contratistas en una pestaña nueva, sin perder este formulario"
                  className="inline-flex items-center gap-1 rounded-xl border border-techblue-200 bg-white px-3 py-2.5 text-xs font-medium text-techblue-700 transition hover:bg-techblue-50"
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden />
                  Crear contratista
                </Link>
              </div>

              {contratistaId && contratistaNombre && (
                <span className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  {contratistaNoEncontrado ? "Creado: " : "Encontrado: "}{contratistaNombre}
                </span>
              )}

              {contratistaNoEncontrado && !contratistaId && (
                <div className="mt-3 space-y-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                    <UserPlus className="h-3.5 w-3.5 flex-none" aria-hidden />
                    Sin coincidencias — créelo rápido aquí, o use &quot;Crear contratista&quot; arriba para el registro completo.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={nuevoTipoPersona}
                      onChange={(e) => setNuevoTipoPersona(e.target.value as TipoPersona)}
                      className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="NATURAL">Persona natural</option>
                      <option value="JURIDICA">Persona jurídica</option>
                    </select>
                    <input
                      value={nuevoNombreORazonSocial}
                      onChange={(e) => setNuevoNombreORazonSocial(e.target.value)}
                      placeholder="Nombre o razón social"
                      className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={crearContratista}
                    disabled={creandoContratista}
                    className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-900 disabled:opacity-50"
                  >
                    {creandoContratista ? "Creando…" : "Crear rápido"}
                  </button>
                </div>
              )}
            </div>
          </SeccionFormulario>

          {supervisores.length > 0 && (
            <>
              <div className="border-t border-dashed border-stone-100" />
              <SeccionFormulario n={4} icon={Users} titulo="Supervisión" subtitulo="Opcional.">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={filtroSupervisor}
                  onChange={(e) => setFiltroSupervisor(e.target.value)}
                  placeholder="Buscar por nombre…"
                  className={campoCls}
                />
                <select value={dependenciaFiltroSupervisor} onChange={(e) => setDependenciaFiltroSupervisor(e.target.value)} className={campoCls}>
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
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                          activo
                            ? "border-cdmb-600 bg-cdmb-600 text-white shadow-sm"
                            : "border-stone-200 bg-white text-stone-600 hover:border-cdmb-300 hover:bg-cdmb-50"
                        }`}
                      >
                        {s.nombre}
                      </button>
                    );
                  })}
                </div>
              )}
              {supervisorUsuarioIds.size > 0 && (
                <p className="text-xs font-medium text-cdmb-700">
                  {supervisorUsuarioIds.size} supervisor{supervisorUsuarioIds.size === 1 ? "" : "es"} seleccionado{supervisorUsuarioIds.size === 1 ? "" : "s"}
                </p>
              )}
              </SeccionFormulario>
            </>
          )}
      </div>

      {error && (
        <div className="mx-6 mb-2 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-stone-100 bg-stone-50/60 px-6 py-4">
        <Link href="/contratacion/expedientes" className="text-sm font-medium text-stone-500 hover:text-stone-700">
          Cancelar
        </Link>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="inline-flex items-center gap-1.5 rounded-xl bg-cdmb-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-cdmb-700 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? "Creando…" : "Crear expediente"}
          {!guardando && <ArrowRight className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
