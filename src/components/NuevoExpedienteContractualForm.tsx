"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  FolderTree,
  CheckCircle2,
  ArrowRight,
  UserCog,
  X,
} from "lucide-react";
import { Field } from "@/components/Field";
import { EncabezadoPaso } from "@/components/sgdea/EncabezadoPaso";
import { CampoMoneda } from "@/components/CampoMoneda";
import { BuscadorDependencia } from "@/components/BuscadorDependencia";
import type { SerieBuscable } from "@/components/BuscadorSubserieTRD";
import { SelectorTrdContrato } from "@/components/SelectorTrdContrato";

type Opcion = { id: string; nombre: string };
type SupervisorOpcion = { id: string; nombre: string; dependenciaNombre?: string | null };
type ModalidadOpcion = { valor: string; etiqueta: string };
type TipoPersona = "NATURAL" | "JURIDICA";

const campoCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 " +
  "transition-shadow focus:border-vivo-500 focus:outline-none focus:ring-4 focus:ring-vivo-500/15";

function SeccionFormulario({
  n,
  icon: Icon,
  titulo,
  subtitulo,
  children,
}: {
  n: number;
  icon: typeof FileText;
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <EncabezadoPaso numero={n} icono={<Icon className="h-4 w-4" aria-hidden />} titulo={titulo} descripcion={subtitulo} />
      <div className="space-y-2.5 pl-9">{children}</div>
    </div>
  );
}

const CLAVE_BORRADOR = "borrador-expediente-gecon";

type Borrador = {
  objeto: string;
  modalidadSeleccion: string;
  valor: string;
  numeroContrato: string;
  numeroProcesoSecop: string;
  fechaSuscripcion: string;
  fechaInicio: string;
  fechaFinEstimada: string;
  dependenciaSolicitanteId: string;
  serieTrdId: string;
  subserieTrdId: string;
  supervisorUsuarioIds: string[];
  personalIds: string[];
  contratista: { id: string; nombre: string; identificacion: string } | null;
};

function leerBorrador(): Borrador | null {
  try {
    const raw = localStorage.getItem(CLAVE_BORRADOR);
    return raw ? (JSON.parse(raw) as Borrador) : null;
  } catch {
    return null;
  }
}

function escribirBorrador(b: Borrador | null) {
  try {
    if (b) localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(b));
    else localStorage.removeItem(CLAVE_BORRADOR);
  } catch {}
}

export function NuevoExpedienteContractualForm({
  dependencias,
  supervisores,
  personal,
  puedeAsignarPersonal,
  modalidades,
  series,
  subseriePorModalidad,
  contratistaInicial,
  enlaceUsuarios,
}: {
  personal: SupervisorOpcion[];
  puedeAsignarPersonal: boolean;
  series: SerieBuscable[];
  subseriePorModalidad: Record<string, string>;
  dependencias: Opcion[];
  supervisores: SupervisorOpcion[];
  modalidades: ModalidadOpcion[];
  contratistaInicial?: { id: string; nombre: string; identificacion: string } | null;
  enlaceUsuarios?: string | null;
}) {
  const router = useRouter();
  const [objeto, setObjeto] = useState("");
  const [modalidadSeleccion, setModalidadSeleccion] = useState(modalidades[0]?.valor ?? "");
  const [valor, setValor] = useState("");
  const [numeroContrato, setNumeroContrato] = useState("");
  const [numeroProcesoSecop, setNumeroProcesoSecop] = useState("");
  const [fechaSuscripcion, setFechaSuscripcion] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFinEstimada, setFechaFinEstimada] = useState("");
  const [dependenciaSolicitanteId, setDependenciaSolicitanteId] = useState("");
  const [serieTrdId, setSerieTrdId] = useState("");
  const [subserieTrdId, setSubserieTrdId] = useState("");
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
  const [personalIds, setPersonalIds] = useState<Set<string>>(new Set());
  const [filtroPersonal, setFiltroPersonal] = useState("");
  const qPersonal = filtroPersonal.trim().toLowerCase();
  const pocoPersonal = personal.length <= 12;
  const personalFiltrado = personal.filter(
    (s) => personalIds.has(s.id) || (qPersonal ? s.nombre.toLowerCase().includes(qPersonal) : pocoPersonal)
  );

  function alternarPersonal(id: string) {
    setPersonalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function quitarContratista() {
    setContratistaId(null);
    setContratistaNombre(null);
    setContratistaNoEncontrado(false);
    setContratistaIdentificacion("");
  }

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borradorRecuperado, setBorradorRecuperado] = useState(false);
  const borradorListo = useRef(false);

  useEffect(() => {
    if (borradorListo.current) return;
    borradorListo.current = true;
    const b = leerBorrador();
    if (b) {
      setObjeto(b.objeto);
      if (modalidades.some((m) => m.valor === b.modalidadSeleccion)) setModalidadSeleccion(b.modalidadSeleccion);
      setValor(b.valor);
      setNumeroContrato(b.numeroContrato);
      setNumeroProcesoSecop(b.numeroProcesoSecop);
      setFechaSuscripcion(b.fechaSuscripcion);
      setFechaInicio(b.fechaInicio);
      setFechaFinEstimada(b.fechaFinEstimada);
      setDependenciaSolicitanteId(b.dependenciaSolicitanteId);
      setSerieTrdId(b.serieTrdId);
      setSubserieTrdId(b.subserieTrdId);
      setSupervisorUsuarioIds(new Set(b.supervisorUsuarioIds));
      setPersonalIds(new Set(b.personalIds));
      if (b.contratista) {
        setContratistaId(b.contratista.id);
        setContratistaNombre(b.contratista.nombre);
        setContratistaIdentificacion(b.contratista.identificacion);
      }
      setBorradorRecuperado(true);
    }
    if (contratistaInicial) {
      setContratistaId(contratistaInicial.id);
      setContratistaNombre(contratistaInicial.nombre);
      setContratistaIdentificacion(contratistaInicial.identificacion);
      setContratistaNoEncontrado(false);
    }
  }, [contratistaInicial, modalidades]);

  useEffect(() => {
    if (!borradorListo.current) return;
    const vacio = !objeto.trim() && !dependenciaSolicitanteId && !valor && !numeroContrato && !numeroProcesoSecop && !contratistaId;
    escribirBorrador(
      vacio
        ? null
        : {
            objeto,
            modalidadSeleccion,
            valor,
            numeroContrato,
            numeroProcesoSecop,
            fechaSuscripcion,
            fechaInicio,
            fechaFinEstimada,
            dependenciaSolicitanteId,
            serieTrdId,
            subserieTrdId,
            supervisorUsuarioIds: Array.from(supervisorUsuarioIds),
            personalIds: Array.from(personalIds),
            contratista: contratistaId && contratistaNombre ? { id: contratistaId, nombre: contratistaNombre, identificacion: contratistaIdentificacion } : null,
          }
    );
  }, [
    objeto,
    modalidadSeleccion,
    valor,
    numeroContrato,
    numeroProcesoSecop,
    fechaSuscripcion,
    fechaInicio,
    fechaFinEstimada,
    dependenciaSolicitanteId,
    serieTrdId,
    subserieTrdId,
    supervisorUsuarioIds,
    personalIds,
    contratistaId,
    contratistaNombre,
    contratistaIdentificacion,
  ]);

  function descartarBorrador() {
    setObjeto("");
    setModalidadSeleccion(modalidades[0]?.valor ?? "");
    setValor("");
    setNumeroContrato("");
    setNumeroProcesoSecop("");
    setFechaSuscripcion("");
    setFechaInicio("");
    setFechaFinEstimada("");
    setDependenciaSolicitanteId("");
    setSerieTrdId("");
    setSubserieTrdId("");
    setSupervisorUsuarioIds(new Set());
    setPersonalIds(new Set());
    quitarContratista();
    setBorradorRecuperado(false);
    escribirBorrador(null);
  }

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
          numeroProcesoSecop: numeroProcesoSecop.trim() || null,
          fechaSuscripcion: fechaSuscripcion || null,
          fechaInicio: fechaInicio || null,
          fechaFinEstimada: fechaFinEstimada || null,
          dependenciaSolicitanteId,
          contratistaId,
          supervisorUsuarioIds: Array.from(supervisorUsuarioIds),
          personalAsignadoIds: Array.from(personalIds),
          subserieId: subserieTrdId || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo crear el expediente.");
      borradorListo.current = false;
      escribirBorrador(null);
      router.push(`/contratacion/expedientes/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  const nuevoContratistaHref = `/contratacion/contratistas/nuevo?retorno=expediente${
    contratistaIdentificacion.trim() ? `&identificacion=${encodeURIComponent(contratistaIdentificacion.trim())}` : ""
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
        {borradorRecuperado && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-xs text-sky-900">
            <span>Se recuperó lo que llevaba escrito en este formulario.</span>
            <button type="button" onClick={descartarBorrador} className="font-medium underline hover:no-underline">
              Empezar de nuevo
            </button>
          </div>
        )}
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

          <SeccionFormulario
            n={2}
            icon={FolderTree}
            titulo="Clasificación TRD"
            subtitulo="Dependencia, serie y subserie donde se archiva todo el expediente. Se asigna según la modalidad de contratación; puede cambiarla ahora o reclasificarla después."
          >
            <SelectorTrdContrato
              series={series}
              subseriePorModalidad={subseriePorModalidad}
              modalidad={modalidadSeleccion}
              modalidadEtiqueta={modalidades.find((m) => m.valor === modalidadSeleccion)?.etiqueta ?? modalidadSeleccion}
              serieId={serieTrdId}
              subserieId={subserieTrdId}
              onChange={(s, ss) => {
                setSerieTrdId(s);
                setSubserieTrdId(ss);
              }}
            />
          </SeccionFormulario>

          <div className="border-t border-dashed border-stone-100" />

          <SeccionFormulario n={3} icon={CircleDollarSign} titulo="Presupuesto y plazo" subtitulo="Opcional.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Valor del contrato" icon={<CircleDollarSign className="h-4 w-4" />} help="En pesos colombianos.">
                <CampoMoneda value={valor} onChange={setValor} className="rounded-xl" />
              </Field>
              <Field label="N.º de proceso SECOP" icon={<Hash className="h-4 w-4" />} help="El de la etapa precontractual, antes de que exista contrato.">
                <input
                  value={numeroProcesoSecop}
                  onChange={(e) => setNumeroProcesoSecop(e.target.value)}
                  placeholder="Ej. IPS-045-2026"
                  className={campoCls}
                />
              </Field>
              <Field label="N.º de contrato SECOP II" icon={<Hash className="h-4 w-4" />}>
                <input
                  value={numeroContrato}
                  onChange={(e) => setNumeroContrato(e.target.value)}
                  placeholder="Ej. 045-2026"
                  className={campoCls}
                />
              </Field>
              <Field label="Fecha de suscripción" icon={<CalendarRange className="h-4 w-4" />} help="Fecha de suscripción del contrato.">
                <input type="date" value={fechaSuscripcion} onChange={(e) => setFechaSuscripcion(e.target.value)} className={campoCls} />
              </Field>
              <Field label="Fecha de inicio" icon={<CalendarRange className="h-4 w-4" />} help="Acta de inicio. De aquí se calculan plazos y vencimientos.">
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={campoCls} />
              </Field>
              <Field label="Fin estimado">
                <input type="date" value={fechaFinEstimada} onChange={(e) => setFechaFinEstimada(e.target.value)} className={campoCls} />
              </Field>
            </div>
          </SeccionFormulario>

          <div className="border-t border-dashed border-stone-100" />

          <SeccionFormulario n={4} icon={UserSearch} titulo="Contratista" subtitulo="Opcional en esta etapa.">
            <div className="rounded-xl border border-cdmb-100 bg-cdmb-50/40 p-3.5">
              <p className="mb-2 text-xs font-semibold text-stone-700">Contratista</p>
              {contratistaId && contratistaNombre ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 flex-none text-emerald-600" aria-hidden />
                    <span>
                      <span className="font-semibold text-stone-900">{contratistaNombre}</span>
                      <span className="text-stone-500"> · {contratistaIdentificacion}</span>
                      <span className="block text-xs text-emerald-700">Seleccionado como contratista del expediente</span>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={quitarContratista}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    Cambiar
                  </button>
                </div>
              ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={contratistaIdentificacion}
                  onChange={(e) => {
                    setContratistaIdentificacion(e.target.value);
                    setContratistaId(null);
                    setContratistaNombre(null);
                    setContratistaNoEncontrado(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      buscarContratista();
                    }
                  }}
                  placeholder="NIT o cédula"
                  className={`${campoCls} w-36 bg-white`}
                />
                <button
                  type="button"
                  onClick={buscarContratista}
                  disabled={buscandoContratista || !contratistaIdentificacion.trim()}
                  className="rounded-xl border border-cdmb-200 bg-white px-3 py-2.5 text-xs font-medium text-cdmb-700 transition hover:bg-cdmb-50 disabled:opacity-50"
                >
                  {buscandoContratista ? "Buscando…" : "Buscar"}
                </button>
                <Link
                  href={nuevoContratistaHref}
                  title="Abre el registro completo del contratista; al guardarlo regresa a este formulario con lo que lleva escrito"
                  className="inline-flex items-center gap-1 rounded-xl border border-cdmb-200 bg-white px-3 py-2.5 text-xs font-medium text-cdmb-700 transition hover:bg-cdmb-50"
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden />
                  Crear contratista
                </Link>
              </div>
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

          {puedeAsignarPersonal && (
            <>
              <div className="border-t border-dashed border-stone-100" />
              <SeccionFormulario
                n={5}
                icon={UserCog}
                titulo="Gestión del expediente"
                subtitulo="Personal de Contratación que gestiona este expediente. Solo quien esté asignado (además del Jefe y el Administrador de Contratación) lo ve y lo trabaja."
              >
              <div className="rounded-xl border border-stone-200 p-3.5">
                {personal.length === 0 ? (
                  <p className="flex flex-wrap items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <AlertTriangle className="h-3.5 w-3.5 flex-none" aria-hidden />
                    Ningún usuario activo tiene el rol Personal de Contratación.
                    {enlaceUsuarios && (
                      <Link href={enlaceUsuarios} className="font-medium underline hover:no-underline">
                        Asignarlo en Usuarios
                      </Link>
                    )}
                  </p>
                ) : (
                  <>
                    <input
                      type="text"
                      value={filtroPersonal}
                      onChange={(e) => setFiltroPersonal(e.target.value)}
                      placeholder="Buscar por nombre…"
                      className={campoCls}
                    />
                    {personalFiltrado.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {personalFiltrado.map((s) => {
                          const activo = personalIds.has(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => alternarPersonal(s.id)}
                              aria-pressed={activo}
                              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                                activo
                                  ? "border-menu-500 bg-menu-500 text-stone-900 shadow-sm"
                                  : "border-stone-200 bg-white text-stone-600 hover:border-cdmb-300 hover:bg-cdmb-50"
                              }`}
                            >
                              {s.nombre}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {personalIds.size > 0 && (
                      <p className="mt-2 text-xs font-medium text-cdmb-700">
                        {personalIds.size} persona{personalIds.size === 1 ? "" : "s"} asignada{personalIds.size === 1 ? "" : "s"}
                      </p>
                    )}
                  </>
                )}
              </div>
              </SeccionFormulario>
            </>
          )}

          {supervisores.length > 0 && (
            <>
              <div className="border-t border-dashed border-stone-100" />
              <SeccionFormulario n={puedeAsignarPersonal ? 6 : 5} icon={Users} titulo="Supervisión" subtitulo="Opcional.">
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
                            ? "border-menu-500 bg-menu-500 text-stone-900 shadow-sm"
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
          className="inline-flex items-center gap-1.5 rounded-xl bg-acento-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-acento-600 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? "Creando…" : "Crear expediente"}
          {!guardando && <ArrowRight className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
