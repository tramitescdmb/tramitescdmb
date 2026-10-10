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
import { BuscadorContratistaUsuario, type ContratistaElegido } from "@/components/BuscadorContratistaUsuario";
import { SelectorPersonasPorRol, type PersonaRol } from "@/components/SelectorPersonasPorRol";

type Opcion = { id: string; nombre: string };
type ModalidadOpcion = { valor: string; etiqueta: string };

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
  contratista: ContratistaElegido | null;
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

function alternarEn(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function NuevoExpedienteContractualForm({
  dependencias,
  supervisores,
  personal,
  puedeAsignarPersonal,
  modalidades,
  series,
  subseriePorModalidad,
}: {
  personal: PersonaRol[];
  puedeAsignarPersonal: boolean;
  series: SerieBuscable[];
  subseriePorModalidad: Record<string, string>;
  dependencias: Opcion[];
  supervisores: PersonaRol[];
  modalidades: ModalidadOpcion[];
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
  const [personalIds, setPersonalIds] = useState<Set<string>>(new Set());
  const [contratista, setContratista] = useState<ContratistaElegido | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borradorRecuperado, setBorradorRecuperado] = useState(false);
  const borradorListo = useRef(false);

  useEffect(() => {
    if (borradorListo.current) return;
    borradorListo.current = true;
    const b = leerBorrador();
    if (!b) return;
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
    if (b.contratista && "tipo" in b.contratista) setContratista(b.contratista);
    setBorradorRecuperado(true);
  }, [modalidades]);

  useEffect(() => {
    if (!borradorListo.current) return;
    const vacio = !objeto.trim() && !dependenciaSolicitanteId && !valor && !numeroContrato && !numeroProcesoSecop && !contratista;
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
            contratista,
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
    contratista,
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
    setContratista(null);
    setBorradorRecuperado(false);
    escribirBorrador(null);
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
          contratistaUsuarioId: contratista?.tipo === "usuario" ? contratista.usuarioId : null,
          contratistaId: contratista?.tipo === "contratista" ? contratista.contratistaId : null,
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

          <SeccionFormulario
            n={4}
            icon={UserSearch}
            titulo="Contratista"
            subtitulo="Opcional en esta etapa. Se elige entre los usuarios registrados; debe tener sus datos completos."
          >
            {contratista ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 flex-none text-emerald-600" aria-hidden />
                  <span>
                    <span className="font-semibold text-stone-900">{contratista.nombre}</span>
                    <span className="text-stone-500"> · {contratista.identificacion}</span>
                    <span className="block text-xs text-emerald-700">Seleccionado como contratista del expediente</span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setContratista(null)}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Cambiar
                </button>
              </div>
            ) : (
              <BuscadorContratistaUsuario onElegir={setContratista} claseCampo={campoCls} />
            )}
          </SeccionFormulario>

          {puedeAsignarPersonal && (
            <>
              <div className="border-t border-dashed border-stone-100" />
              <SeccionFormulario
                n={5}
                icon={UserCog}
                titulo="Gestión del expediente"
                subtitulo="Personal de Contratación que lo gestiona. Solo quien esté asignado (además del Jefe y del Administrador de Contratación) lo ve y lo trabaja."
              >
                <SelectorPersonasPorRol
                  personas={personal}
                  seleccionados={personalIds}
                  onAlternar={(id) => setPersonalIds((prev) => alternarEn(prev, id))}
                  nombreRol="Personal de Contratación"
                  claseCampo={campoCls}
                />
              </SeccionFormulario>
            </>
          )}

          <div className="border-t border-dashed border-stone-100" />
          <SeccionFormulario n={puedeAsignarPersonal ? 6 : 5} icon={Users} titulo="Supervisión" subtitulo="Opcional.">
            <SelectorPersonasPorRol
              personas={supervisores}
              seleccionados={supervisorUsuarioIds}
              onAlternar={(id) => setSupervisorUsuarioIds((prev) => alternarEn(prev, id))}
              nombreRol="Supervisor / Interventor"
              claseCampo={campoCls}
            />
          </SeccionFormulario>
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
