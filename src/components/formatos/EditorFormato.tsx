"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, Copy, Eye, Plus, Printer, Save, Send, Trash2, Undo2 } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import { ZONAS } from "@/lib/zonificacion";
import { FormularioFormato } from "@/components/formatos/FormularioFormato";
import {
  actualizarTextosTipo,
  aplicarZonificacion,
  idDesdeEtiqueta,
  idsReferenciables,
  PRECARGAS,
  respuestasIniciales,
  TIPOS_CAMPO,
  TIPOS_COLUMNA,
  validarEstructura,
  variablesDisponibles,
  type Campo,
  type ColumnaTabla,
  type DatosPrecarga,
  type EstructuraFormato,
  type Respuestas,
  type Seccion,
  type TipoCampo,
  type TipoColumna,
  type ValorCampo,
} from "@/lib/formato-visita";

type Meta = {
  id: string;
  codigo: string;
  nombre: string;
  titulo: string;
  versionDocumento: string;
  fechaDocumento: string;
  tramites: string[];
  activo: boolean;
  porDefecto: boolean;
};

type Version = { id: string; numero: number; estado: "BORRADOR" | "PUBLICADA" | "REEMPLAZADA"; nota: string | null; autor: string; fecha: string; visitas: number };
type Tipo = { codigo: string; nombre: string; ocupadoPor: string | null };

const campoCls = "w-full rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";
const chicoCls = "w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs focus:border-vivo-500 focus:outline-none";
const botonIcono = "rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-30";

const PRECARGA_EJEMPLO: DatosPrecarga = {
  expediente: "M-DA-PR00-2026-0001",
  tramite: "Trámite de ejemplo",
  solicitante: "NOMBRE DEL SOLICITANTE",
  identificacion: "C.C. 00.000.000",
  municipio: "Bucaramanga",
  predio: "Predio de ejemplo",
  matricula: "300-000000",
  funcionario: "Profesional asignado",
  fecha_visita: new Date().toISOString().slice(0, 10),
};

const ETIQUETA_ESTADO: Record<Version["estado"], string> = { BORRADOR: "Borrador", PUBLICADA: "Vigente", REEMPLAZADA: "Reemplazada" };

function idsUsados(e: EstructuraFormato): Set<string> {
  return new Set(e.secciones.flatMap((s) => s.campos.map((c) => c.id)));
}

function mover<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const copia = [...arr];
  [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  return copia;
}

function campoNuevo(tipo: TipoCampo, usados: Set<string>): Campo {
  const etiqueta = `Nuevo campo (${TIPOS_CAMPO[tipo].toLowerCase()})`;
  const c: Campo = { id: idDesdeEtiqueta(tipo === "tabla" ? "tabla" : "campo", usados), etiqueta, tipo };
  if (tipo === "seleccion") c.opciones = ["Opción 1", "Opción 2"];
  if (tipo === "calculado") c.formula = "";
  if (tipo === "lista_chequeo") c.items = [{ texto: "Texto tipo", marcado: true }];
  if (tipo === "tabla") c.columnas = [{ id: "descripcion", titulo: "Descripción", tipo: "texto" }];
  return c;
}

export function EditorFormato({
  formato,
  estructuraInicial,
  hayBorrador,
  hayPublicada,
  numeroEnEdicion,
  versiones,
  tipos,
}: {
  formato: Meta;
  estructuraInicial: EstructuraFormato;
  hayBorrador: boolean;
  hayPublicada: boolean;
  numeroEnEdicion: number;
  versiones: Version[];
  tipos: Tipo[];
}) {
  const router = useRouter();
  const [pestana, setPestana] = useState<"diseno" | "vista" | "datos" | "versiones">("diseno");
  const [meta, setMeta] = useState<Meta>(formato);
  const [estructura, setEstructura] = useState<EstructuraFormato>(estructuraInicial);
  const [nota, setNota] = useState("");
  const [sucio, setSucio] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [vistaRespuestas, setVistaRespuestas] = useState<Respuestas | null>(null);
  const [buscarTipo, setBuscarTipo] = useState("");

  const validacion = useMemo(() => validarEstructura(estructura), [estructura]);
  const errorEstructura = "error" in validacion ? validacion.error : null;

  function cambiar(e: EstructuraFormato) {
    setEstructura(e);
    setSucio(true);
    setVistaRespuestas(null);
  }

  const fijarSeccion = (si: number, s: Seccion) => cambiar({ secciones: estructura.secciones.map((x, i) => (i === si ? s : x)) });
  const fijarCampo = (si: number, ci: number, c: Campo) => {
    const s = estructura.secciones[si]!;
    fijarSeccion(si, { ...s, campos: s.campos.map((x, i) => (i === ci ? c : x)) });
  };

  async function llamar(url: string, metodo: string, cuerpo?: unknown): Promise<Record<string, unknown> | null> {
    setMensaje(null);
    try {
      const res = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo completar la operación.");
      return data;
    } catch (e) {
      setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "Ocurrió un error inesperado." });
      return null;
    }
  }

  async function guardarBorrador(): Promise<boolean> {
    if (errorEstructura) {
      setMensaje({ tipo: "error", texto: errorEstructura });
      return false;
    }
    setOcupado("guardar");
    const r = await llamar(`/api/formatos-visita/${meta.id}/borrador`, "PUT", { estructura, nota });
    setOcupado(null);
    if (!r) return false;
    setSucio(false);
    setMensaje({ tipo: "ok", texto: `Borrador v${r.numero} guardado. Los técnicos siguen usando la versión vigente hasta que se publique.` });
    router.refresh();
    return true;
  }

  async function publicar() {
    if (!window.confirm(`¿Publicar la versión ${numeroEnEdicion}? Desde ese momento las nuevas visitas usarán este formato; las ya registradas conservan su versión.`)) return;
    if ((sucio || !hayBorrador) && !(await guardarBorrador())) return;
    setOcupado("publicar");
    const r = await llamar(`/api/formatos-visita/${meta.id}/publicar`, "POST");
    setOcupado(null);
    if (r) {
      setMensaje({ tipo: "ok", texto: `Versión ${r.numero} publicada.` });
      setNota("");
      router.refresh();
    }
  }

  async function descartar() {
    if (!window.confirm("¿Descartar el borrador y volver a la versión vigente?")) return;
    setOcupado("descartar");
    const r = await llamar(`/api/formatos-visita/${meta.id}/borrador`, "DELETE");
    setOcupado(null);
    if (r) {
      setSucio(false);
      window.location.reload();
    }
  }

  async function guardarDatos() {
    setOcupado("datos");
    const r = await llamar(`/api/formatos-visita/${meta.id}`, "PATCH", meta);
    setOcupado(null);
    if (r) {
      setMensaje({ tipo: "ok", texto: "Datos del formato guardados." });
      router.refresh();
    }
  }

  const pestanas = [
    { id: "diseno", etiqueta: "Diseño" },
    { id: "vista", etiqueta: "Vista previa" },
    { id: "datos", etiqueta: "Datos y trámites" },
    { id: "versiones", etiqueta: `Versiones (${versiones.length})` },
  ] as const;

  const respuestasVista = vistaRespuestas ?? respuestasIniciales(estructura, PRECARGA_EJEMPLO);
  const totalCampos = estructura.secciones.reduce((a, s) => a + s.campos.length, 0);

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-white/95 px-3 py-2 shadow-soft backdrop-blur">
        <div className="flex rounded-lg border border-stone-200 bg-stone-50 p-0.5" role="tablist" aria-label="Secciones del editor">
          {pestanas.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              onClick={() => setPestana(p.id)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ${pestana === p.id ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200" : "text-stone-500 hover:text-stone-800"}`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
        <span className="text-xs text-stone-500">
          Editando v{numeroEnEdicion}
          {sucio ? " · cambios sin guardar" : hayBorrador ? " · borrador guardado" : ""}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {hayBorrador && hayPublicada && (
            <button type="button" onClick={descartar} disabled={!!ocupado} className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50">
              {ocupado === "descartar" ? <Spinner /> : <Undo2 className="h-3.5 w-3.5" aria-hidden />}
              Descartar borrador
            </button>
          )}
          <button type="button" onClick={guardarBorrador} disabled={!!ocupado || !sucio} className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50">
            {ocupado === "guardar" ? <Spinner /> : <Save className="h-3.5 w-3.5" aria-hidden />}
            Guardar borrador
          </button>
          <button type="button" onClick={publicar} disabled={!!ocupado || (!sucio && !hayBorrador) || !!errorEstructura} className="inline-flex items-center gap-1 rounded-md bg-acento-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-acento-600 disabled:opacity-50">
            {ocupado === "publicar" ? <Spinner claro /> : <Send className="h-3.5 w-3.5" aria-hidden />}
            Publicar
          </button>
        </div>
      </div>

      {mensaje && <p className={`rounded-lg px-3 py-2 text-xs ${mensaje.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{mensaje.texto}</p>}
      {errorEstructura && pestana === "diseno" && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Por corregir antes de guardar: {errorEstructura}</p>}

      {pestana === "diseno" && (
        <div className="space-y-3">
          <p className="text-xs text-stone-500">
            {estructura.secciones.length} sección(es) · {totalCampos} campo(s)
          </p>
          {estructura.secciones.map((s, si) => {
            const plegada = plegadas.has(s.id);
            return (
              <section key={si} className="rounded-2xl border border-stone-200 bg-white shadow-soft">
                <header className="flex items-center gap-2 border-b border-stone-100 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setPlegadas((p) => (p.has(s.id) ? new Set([...p].filter((x) => x !== s.id)) : new Set([...p, s.id])))}
                    className={botonIcono}
                    aria-label={plegada ? "Desplegar sección" : "Plegar sección"}
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${plegada ? "-rotate-90" : ""}`} aria-hidden />
                  </button>
                  <input value={s.titulo} onChange={(e) => fijarSeccion(si, { ...s, titulo: e.target.value })} className={`${campoCls} font-semibold`} aria-label="Título de la sección" />
                  <span className="hidden flex-none text-[11px] text-stone-400 sm:inline">{s.campos.length} campo(s)</span>
                  <button type="button" onClick={() => cambiar({ secciones: mover(estructura.secciones, si, -1) })} disabled={si === 0} className={botonIcono} aria-label="Subir sección">
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" onClick={() => cambiar({ secciones: mover(estructura.secciones, si, 1) })} disabled={si === estructura.secciones.length - 1} className={botonIcono} aria-label="Bajar sección">
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (s.campos.length === 0 || window.confirm(`¿Eliminar la sección «${s.titulo}» y sus ${s.campos.length} campo(s)?`)) cambiar({ secciones: estructura.secciones.filter((_, i) => i !== si) });
                    }}
                    className={`${botonIcono} hover:!bg-red-50 hover:!text-red-600`}
                    aria-label="Eliminar sección"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </header>
                {!plegada && (
                  <div className="divide-y divide-stone-100">
                    {s.campos.map((c, ci) => {
                      const llave = `${s.id}:${c.id}`;
                      const expandido = abierto === llave;
                      return (
                        <div key={ci} className={expandido ? "bg-stone-50/70" : ""}>
                          <div className="flex items-center gap-2 px-3 py-1.5">
                            <button type="button" onClick={() => setAbierto(expandido ? null : llave)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                              <ChevronDown className={`h-3.5 w-3.5 flex-none text-stone-400 transition-transform ${expandido ? "" : "-rotate-90"}`} aria-hidden />
                              <span className="truncate text-sm text-stone-800">{c.etiqueta}</span>
                              {c.obligatorio && <span className="text-xs text-red-600">*</span>}
                              <span className="flex-none rounded-sm bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">{TIPOS_CAMPO[c.tipo]}</span>
                              {c.precarga && <span className="hidden flex-none rounded-sm bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700 sm:inline">precargado</span>}
                              {c.zona && <span className="hidden flex-none rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 sm:inline">desde el GPS</span>}
                            </button>
                            <button type="button" onClick={() => fijarSeccion(si, { ...s, campos: mover(s.campos, ci, -1) })} disabled={ci === 0} className={botonIcono} aria-label="Subir campo">
                              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button type="button" onClick={() => fijarSeccion(si, { ...s, campos: mover(s.campos, ci, 1) })} disabled={ci === s.campos.length - 1} className={botonIcono} aria-label="Bajar campo">
                              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const usados = idsUsados(estructura);
                                const copia = { ...structuredClone(c), id: idDesdeEtiqueta(c.id, usados), etiqueta: `${c.etiqueta} (copia)` };
                                fijarSeccion(si, { ...s, campos: [...s.campos.slice(0, ci + 1), copia, ...s.campos.slice(ci + 1)] });
                              }}
                              className={botonIcono}
                              aria-label="Duplicar campo"
                            >
                              <Copy className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => window.confirm(`¿Eliminar el campo «${c.etiqueta}»?`) && fijarSeccion(si, { ...s, campos: s.campos.filter((_, i) => i !== ci) })}
                              className={`${botonIcono} hover:!bg-red-50 hover:!text-red-600`}
                              aria-label="Eliminar campo"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
                          {expandido && (
                            <EditorCampo
                              campo={c}
                              estructura={estructura}
                              secciones={estructura.secciones}
                              seccionActual={si}
                              onCambio={(nuevo) => {
                                fijarCampo(si, ci, nuevo);
                                if (nuevo.id !== c.id) setAbierto(`${s.id}:${nuevo.id}`);
                              }}
                              onMover={(destino) => {
                                const sinCampo = estructura.secciones.map((x, i) => (i === si ? { ...x, campos: x.campos.filter((_, j) => j !== ci) } : x));
                                cambiar({ secciones: sinCampo.map((x, i) => (i === destino ? { ...x, campos: [...x.campos, c] } : x)) });
                                setAbierto(null);
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                    <AgregarCampo
                      onAgregar={(tipo) => {
                        const nuevo = campoNuevo(tipo, idsUsados(estructura));
                        fijarSeccion(si, { ...s, campos: [...s.campos, nuevo] });
                        setAbierto(`${s.id}:${nuevo.id}`);
                      }}
                    />
                  </div>
                )}
              </section>
            );
          })}
          <button
            type="button"
            onClick={() => {
              const ids = new Set(estructura.secciones.map((s) => s.id));
              cambiar({ secciones: [...estructura.secciones, { id: idDesdeEtiqueta("seccion", ids), titulo: "Nueva sección", campos: [] }] });
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-white"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Agregar sección
          </button>
          <label className="block text-xs text-stone-600">
            Nota de esta versión (qué cambió)
            <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000} className={`mt-0.5 ${campoCls}`} placeholder="Ej. Se agregó la tabla de puntos de recepción" />
          </label>
        </div>
      )}

      {pestana === "vista" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">
            <Eye className="h-4 w-4 flex-none" aria-hidden />
            Así verá el técnico el formulario en la visita (v{numeroEnEdicion}, con datos de ejemplo). Lo que se escriba aquí no se guarda.
            <a href={`/planeador/formatos/${meta.id}/documento`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 font-medium text-cdmb-700 hover:underline">
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Documento en blanco (versión guardada)
            </a>
          </div>
          {errorEstructura ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Corrija el diseño para ver la vista previa: {errorEstructura}</p>
          ) : (
            <FormularioFormato
              estructura={estructura}
              respuestas={respuestasVista}
              precarga={PRECARGA_EJEMPLO}
              onZonificar={(coordId, zona) => setVistaRespuestas(aplicarZonificacion(estructura, respuestasVista, coordId, zona, null))}
              onCambio={(id: string, v: ValorCampo) => setVistaRespuestas(actualizarTextosTipo(estructura, respuestasVista, { ...respuestasVista, [id]: v }, PRECARGA_EJEMPLO))}
            />
          )}
        </div>
      )}

      {pestana === "datos" && (
        <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <label className="text-xs text-stone-600">
              Código
              <input value={meta.codigo} onChange={(e) => setMeta({ ...meta, codigo: e.target.value })} className={`mt-0.5 ${campoCls}`} />
            </label>
            <label className="text-xs text-stone-600">
              Nombre corto
              <input value={meta.nombre} onChange={(e) => setMeta({ ...meta, nombre: e.target.value })} className={`mt-0.5 ${campoCls}`} />
            </label>
            <label className="text-xs text-stone-600">
              Versión del documento
              <input value={meta.versionDocumento} onChange={(e) => setMeta({ ...meta, versionDocumento: e.target.value })} className={`mt-0.5 ${campoCls}`} />
            </label>
            <label className="text-xs text-stone-600">
              Fecha del documento
              <input value={meta.fechaDocumento} onChange={(e) => setMeta({ ...meta, fechaDocumento: e.target.value })} placeholder="02/06/2021" className={`mt-0.5 ${campoCls}`} />
            </label>
            <label className="text-xs text-stone-600 sm:col-span-4">
              Título del documento
              <input value={meta.titulo} onChange={(e) => setMeta({ ...meta, titulo: e.target.value })} className={`mt-0.5 ${campoCls}`} />
            </label>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={meta.activo} onChange={(e) => setMeta({ ...meta, activo: e.target.checked })} className="text-cdmb-600" />
            Formato activo
          </label>
          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={meta.porDefecto} onChange={(e) => setMeta({ ...meta, porDefecto: e.target.checked })} className="mt-0.5 text-cdmb-600" />
            <span>
              Formato genérico
              <span className="block text-xs text-stone-500">Se usa en todos los trámites con visita técnica que no tienen un formato propio, incluidos los procedimientos que se creen después.</span>
            </span>
          </label>
          <div>
            <p className="mb-1 text-xs font-medium text-stone-600">Trámites que usan este formato ({meta.tramites.length})</p>
            <input value={buscarTipo} onChange={(e) => setBuscarTipo(e.target.value)} placeholder="Buscar trámite…" className={`mb-1.5 ${campoCls}`} />
            <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-md border border-stone-200 p-1.5">
              {tipos
                .filter((t) => !buscarTipo.trim() || `${t.codigo} ${t.nombre}`.toLowerCase().includes(buscarTipo.trim().toLowerCase()))
                .map((t) => {
                  const marcado = meta.tramites.includes(t.codigo);
                  return (
                    <label key={t.codigo} className={`flex items-start gap-2 rounded px-1.5 py-1 text-xs ${t.ocupadoPor && !marcado ? "text-stone-400" : "text-stone-700"} hover:bg-stone-50`}>
                      <input
                        type="checkbox"
                        checked={marcado}
                        disabled={!!t.ocupadoPor && !marcado}
                        onChange={() => setMeta({ ...meta, tramites: marcado ? meta.tramites.filter((x) => x !== t.codigo) : [...meta.tramites, t.codigo] })}
                        className="mt-0.5 text-cdmb-600"
                      />
                      <span>
                        <span className="font-mono text-[11px] text-stone-400">{t.codigo}</span> {t.nombre}
                        {t.ocupadoPor && !marcado && <span className="block text-[10px]">Usa el formato «{t.ocupadoPor}»</span>}
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>
          <button type="button" onClick={guardarDatos} disabled={!!ocupado} className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-60">
            {ocupado === "datos" && <Spinner claro />}
            Guardar datos del formato
          </button>
        </div>
      )}

      {pestana === "versiones" && (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                <th className="px-3 py-2 font-medium">Versión</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Por</th>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Nota</th>
                <th className="px-3 py-2 text-right font-medium">Visitas</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {versiones.map((v) => (
                <tr key={v.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-3 py-2 font-medium">v{v.numero}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-sm px-1.5 py-0.5 text-[11px] ${v.estado === "PUBLICADA" ? "bg-emerald-50 text-emerald-700" : v.estado === "BORRADOR" ? "bg-amber-50 text-amber-800" : "bg-stone-100 text-stone-500"}`}
                    >
                      {ETIQUETA_ESTADO[v.estado]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-600">{v.autor}</td>
                  <td className="px-3 py-2 text-xs text-stone-600">{new Date(v.fecha).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="px-3 py-2 text-xs text-stone-600">{v.nota ?? ""}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{v.visitas}</td>
                  <td className="px-3 py-2 text-right">
                    <a href={`/planeador/formatos/${meta.id}/documento?version=${v.numero}`} target="_blank" rel="noreferrer" className="text-xs text-cdmb-700 hover:underline">
                      Ver
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AgregarCampo({ onAgregar }: { onAgregar: (t: TipoCampo) => void }) {
  const [tipo, setTipo] = useState<TipoCampo>("texto");
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCampo)} className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs">
        {Object.entries(TIPOS_CAMPO).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => onAgregar(tipo)} className="inline-flex items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline">
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Agregar campo
      </button>
    </div>
  );
}

function EditorCampo({
  campo,
  estructura,
  secciones,
  seccionActual,
  onCambio,
  onMover,
}: {
  campo: Campo;
  estructura: EstructuraFormato;
  secciones: Seccion[];
  seccionActual: number;
  onCambio: (c: Campo) => void;
  onMover: (destino: number) => void;
}) {
  const fijar = <K extends keyof Campo>(k: K, v: Campo[K]) => {
    const c = { ...campo, [k]: v };
    if (v === undefined || v === "" || v === false) delete c[k];
    onCambio(c);
  };
  const refs = [...idsReferenciables(estructura)].filter((r) => r !== campo.id);
  const coordenadas = estructura.secciones.flatMap((s) => s.campos).filter((c) => c.tipo === "coordenadas");
  const variables = variablesDisponibles(estructura).filter((v) => v.clave !== campo.id);

  return (
    <div className="space-y-2.5 border-t border-stone-100 px-4 py-3 sm:pl-9">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
        <label className="text-[11px] text-stone-500 sm:col-span-3">
          Nombre del campo
          <input value={campo.etiqueta} onChange={(e) => fijar("etiqueta", e.target.value)} className={`mt-0.5 ${chicoCls}`} />
        </label>
        <label className="text-[11px] text-stone-500 sm:col-span-2" title="Se usa en fórmulas y textos tipo como {identificador}.">
          Identificador
          <input
            value={campo.id}
            onChange={(e) => fijar("id", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40))}
            className={`mt-0.5 font-mono ${chicoCls}`}
          />
        </label>
        <label className="text-[11px] text-stone-500">
          Tipo
          <select value={campo.tipo} onChange={(e) => onCambio({ ...campoNuevo(e.target.value as TipoCampo, new Set()), id: campo.id, etiqueta: campo.etiqueta })} className={`mt-0.5 ${chicoCls}`}>
            {Object.entries(TIPOS_CAMPO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {campo.tipo !== "calculado" && (
          <label className="inline-flex items-center gap-1.5 text-xs text-stone-700">
            <input type="checkbox" checked={!!campo.obligatorio} onChange={(e) => fijar("obligatorio", e.target.checked)} className="text-cdmb-600" />
            Obligatorio
          </label>
        )}
        {(campo.tipo === "texto" || campo.tipo === "numero" || campo.tipo === "fecha" || campo.tipo === "parrafo") && (
          <label className="inline-flex items-center gap-1.5 text-xs text-stone-700">
            Precargar con
            <select value={campo.precarga ?? ""} onChange={(e) => fijar("precarga", (e.target.value || undefined) as Campo["precarga"])} className="rounded border border-stone-200 bg-white px-1.5 py-0.5 text-xs">
              <option value="">— nada —</option>
              {Object.entries(PRECARGAS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
        {(campo.tipo === "texto" || campo.tipo === "parrafo") && coordenadas.length > 0 && (
          <label className="inline-flex items-center gap-1.5 text-xs text-stone-700">
            Llenar desde el GPS con
            <select
              value={campo.zona ? `${campo.desde}|${campo.zona}` : ""}
              onChange={(e) => {
                const [desde, zona] = e.target.value.split("|");
                const c = { ...campo };
                if (desde && zona) Object.assign(c, { desde, zona });
                else {
                  delete c.desde;
                  delete c.zona;
                }
                onCambio(c);
              }}
              className="rounded border border-stone-200 bg-white px-1.5 py-0.5 text-xs"
            >
              <option value="">— nada —</option>
              {coordenadas.flatMap((co) =>
                Object.entries(ZONAS).map(([k, etiqueta]) => (
                  <option key={`${co.id}|${k}`} value={`${co.id}|${k}`}>
                    {etiqueta}
                    {coordenadas.length > 1 ? ` — ${co.etiqueta}` : ""}
                  </option>
                ))
              )}
            </select>
          </label>
        )}
        {campo.tipo === "coordenadas" && (
          <label className="inline-flex items-center gap-1.5 text-xs text-stone-700">
            <input type="checkbox" checked={!!campo.conCota} onChange={(e) => fijar("conCota", e.target.checked)} className="text-cdmb-600" />
            Pedir cota
          </label>
        )}
        {secciones.length > 1 && (
          <label className="inline-flex items-center gap-1.5 text-xs text-stone-700">
            Mover a
            <select value="" onChange={(e) => e.target.value !== "" && onMover(Number(e.target.value))} className="rounded border border-stone-200 bg-white px-1.5 py-0.5 text-xs">
              <option value="">…</option>
              {secciones.map((s, i) =>
                i === seccionActual ? null : (
                  <option key={i} value={i}>
                    {s.titulo}
                  </option>
                )
              )}
            </select>
          </label>
        )}
      </div>

      <label className="block text-[11px] text-stone-500">
        Ayuda (se muestra en el ícono de información)
        <input value={campo.ayuda ?? ""} onChange={(e) => fijar("ayuda", e.target.value || undefined)} className={`mt-0.5 ${chicoCls}`} />
      </label>

      {(campo.tipo === "numero" || campo.tipo === "calculado") && (
        <div className="grid grid-cols-2 gap-2 sm:w-80">
          <label className="text-[11px] text-stone-500">
            Unidad
            <input value={campo.unidad ?? ""} onChange={(e) => fijar("unidad", e.target.value || undefined)} placeholder="m³, l/s, ha…" className={`mt-0.5 ${chicoCls}`} />
          </label>
          <label className="text-[11px] text-stone-500">
            Decimales
            <input
              type="number"
              min={0}
              max={6}
              value={campo.decimales ?? ""}
              onChange={(e) => fijar("decimales", e.target.value === "" ? undefined : Math.max(0, Math.min(6, Number(e.target.value))))}
              className={`mt-0.5 ${chicoCls}`}
            />
          </label>
        </div>
      )}

      {campo.tipo === "calculado" && (
        <div>
          <label className="block text-[11px] text-stone-500">
            Fórmula
            <input value={campo.formula ?? ""} onChange={(e) => fijar("formula", e.target.value)} placeholder="caudal_autorizar / caudal_minimo * 100" className={`mt-0.5 font-mono ${chicoCls}`} />
          </label>
          <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
            Operadores + − × (*) ÷ (/) y potencia (^); funciones raiz(), redondear(x; n), abs(), min(), max(); constante pi. «tabla.columna» suma la columna y «tabla._filas» cuenta las filas.
          </p>
          <Chips valores={refs} onClick={(r) => fijar("formula", `${campo.formula ?? ""}${campo.formula ? " " : ""}${r}`)} />
        </div>
      )}

      {campo.tipo === "seleccion" && (
        <label className="block text-[11px] text-stone-500">
          Opciones (una por línea)
          <textarea
            value={(campo.opciones ?? []).join("\n")}
            onChange={(e) => fijar("opciones", e.target.value.split("\n"))}
            onBlur={(e) => fijar("opciones", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))}
            rows={Math.max(3, (campo.opciones ?? []).length)}
            className={`mt-0.5 ${chicoCls}`}
          />
        </label>
      )}

      {campo.tipo === "parrafo" && (
        <div>
          <label className="block text-[11px] text-stone-500">
            Texto tipo (el técnico lo recibe diligenciado y puede ajustarlo)
            <textarea value={campo.plantilla ?? ""} onChange={(e) => fijar("plantilla", e.target.value || undefined)} rows={4} className={`mt-0.5 ${chicoCls}`} />
          </label>
          <Variables variables={variables} onClick={(v) => fijar("plantilla", `${campo.plantilla ?? ""}{${v}}`)} />
        </div>
      )}

      {campo.tipo === "lista_chequeo" && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-stone-500">Textos tipo. El técnico marca los que aplican; los marcados aquí vienen seleccionados por defecto.</p>
          {(campo.items ?? []).map((it, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <input
                type="checkbox"
                checked={!!it.marcado}
                onChange={(e) => fijar("items", (campo.items ?? []).map((x, j) => (j === i ? (e.target.checked ? { ...x, marcado: true } : { texto: x.texto }) : x)))}
                className="mt-1.5 text-cdmb-600"
                title="Marcado por defecto"
              />
              <textarea
                value={it.texto}
                onChange={(e) => fijar("items", (campo.items ?? []).map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))}
                rows={2}
                className={chicoCls}
              />
              <button type="button" onClick={() => fijar("items", mover(campo.items ?? [], i, -1))} disabled={i === 0} className={botonIcono} aria-label="Subir texto">
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button type="button" onClick={() => fijar("items", (campo.items ?? []).filter((_, j) => j !== i))} className={`${botonIcono} hover:!text-red-600`} aria-label="Quitar texto">
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => fijar("items", [...(campo.items ?? []), { texto: "", marcado: true }])} className="inline-flex items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Agregar texto
          </button>
          <Variables variables={variables} />
        </div>
      )}

      {campo.tipo === "tabla" && <EditorColumnas campo={campo} onCambio={onCambio} />}
    </div>
  );
}

function Chips({ valores, onClick }: { valores: string[]; onClick: (v: string) => void }) {
  if (valores.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {valores.map((v) => (
        <button key={v} type="button" onClick={() => onClick(v)} className="rounded-sm border border-stone-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-stone-600 hover:border-cdmb-300 hover:bg-cdmb-50">
          {v}
        </button>
      ))}
    </div>
  );
}

function Variables({ variables, onClick }: { variables: { clave: string; etiqueta: string }[]; onClick?: (v: string) => void }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setVer((v) => !v)} className="inline-flex items-center gap-1 text-[11px] font-medium text-cdmb-700">
        <ChevronDown className={`h-3 w-3 transition-transform ${ver ? "rotate-180" : ""}`} aria-hidden />
        Variables disponibles ({"{"}nombre{"}"})
      </button>
      {ver && (
        <div className="mt-1 flex flex-wrap gap-1">
          {variables.map((v) => (
            <button
              key={v.clave}
              type="button"
              title={v.etiqueta}
              onClick={() => (onClick ? onClick(v.clave) : navigator.clipboard?.writeText(`{${v.clave}}`))}
              className="rounded-sm border border-stone-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-stone-600 hover:border-cdmb-300 hover:bg-cdmb-50"
            >
              {`{${v.clave}}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EditorColumnas({ campo, onCambio }: { campo: Campo; onCambio: (c: Campo) => void }) {
  const cols = campo.columnas ?? [];
  const fijarCols = (nuevas: ColumnaTabla[]) => onCambio({ ...campo, columnas: nuevas });
  const fijarCol = (i: number, cambios: Partial<ColumnaTabla>) => {
    const c = { ...cols[i]!, ...cambios };
    for (const k of Object.keys(c) as (keyof ColumnaTabla)[]) if (c[k] === undefined || c[k] === "" || c[k] === false) delete c[k];
    fijarCols(cols.map((x, j) => (j === i ? c : x)));
  };
  const numericas = cols.filter((c) => c.tipo === "numero" || c.tipo === "calculado").map((c) => c.id);

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-stone-600">Columnas</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="text-left text-[10px] text-stone-500">
              <th className="px-1 py-1 font-medium">Título</th>
              <th className="px-1 py-1 font-medium">Identificador</th>
              <th className="px-1 py-1 font-medium">Tipo</th>
              <th className="px-1 py-1 font-medium">Fórmula / comparación</th>
              <th className="px-1 py-1 font-medium">Dec.</th>
              <th className="px-1 py-1 font-medium">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cols.map((c, i) => (
              <tr key={i} className="align-top">
                <td className="px-1 py-0.5">
                  <input value={c.titulo} onChange={(e) => fijarCol(i, { titulo: e.target.value })} className={chicoCls} />
                </td>
                <td className="px-1 py-0.5">
                  <input value={c.id} onChange={(e) => fijarCol(i, { id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40) })} className={`font-mono ${chicoCls}`} />
                </td>
                <td className="px-1 py-0.5">
                  <select value={c.tipo} onChange={(e) => fijarCol(i, { tipo: e.target.value as TipoColumna, formula: undefined, total: undefined, limite: undefined, resultado: undefined })} className={chicoCls}>
                    {Object.entries(TIPOS_COLUMNA).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-0.5">
                  {c.tipo === "calculado" && (
                    <>
                      <input value={c.formula ?? ""} onChange={(e) => fijarCol(i, { formula: e.target.value })} placeholder={numericas.slice(0, 2).join(" * ") || "a * b"} className={`font-mono ${chicoCls}`} />
                      <Chips valores={numericas.filter((x) => x !== c.id)} onClick={(r) => fijarCol(i, { formula: `${c.formula ?? ""}${c.formula ? " " : ""}${r}` })} />
                    </>
                  )}
                  {c.tipo === "cumplimiento" && (
                    <div className="flex gap-1">
                      <select value={c.limite ?? ""} onChange={(e) => fijarCol(i, { limite: e.target.value || undefined })} className={chicoCls} title="Columna con el límite">
                        <option value="">Límite…</option>
                        {cols.filter((x) => x.id !== c.id).map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.titulo}
                          </option>
                        ))}
                      </select>
                      <select value={c.resultado ?? ""} onChange={(e) => fijarCol(i, { resultado: e.target.value || undefined })} className={chicoCls} title="Columna con el resultado">
                        <option value="">Resultado…</option>
                        {cols.filter((x) => x.id !== c.id).map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.titulo}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {c.tipo === "numero" && (
                    <label className="inline-flex items-center gap-1 text-[10px] text-stone-500">
                      <input type="checkbox" checked={!!c.vacioComoCero} onChange={(e) => fijarCol(i, { vacioComoCero: e.target.checked })} />
                      Vacío cuenta como 0
                    </label>
                  )}
                </td>
                <td className="px-1 py-0.5">
                  {(c.tipo === "numero" || c.tipo === "calculado") && (
                    <input
                      type="number"
                      min={0}
                      max={6}
                      value={c.decimales ?? ""}
                      onChange={(e) => fijarCol(i, { decimales: e.target.value === "" ? undefined : Math.max(0, Math.min(6, Number(e.target.value))) })}
                      className={`w-12 ${chicoCls}`}
                    />
                  )}
                </td>
                <td className="px-1 py-0.5 text-center">
                  {(c.tipo === "numero" || c.tipo === "calculado") && <input type="checkbox" checked={!!c.total} onChange={(e) => fijarCol(i, { total: e.target.checked })} aria-label="Sumar columna" />}
                </td>
                <td className="whitespace-nowrap px-1 py-0.5">
                  <button type="button" onClick={() => fijarCols(mover(cols, i, -1))} disabled={i === 0} className={botonIcono} aria-label="Mover a la izquierda">
                    <ArrowUp className="h-3.5 w-3.5 -rotate-90" aria-hidden />
                  </button>
                  <button type="button" onClick={() => fijarCols(cols.filter((_, j) => j !== i))} className={`${botonIcono} hover:!text-red-600`} aria-label="Quitar columna">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => fijarCols([...cols, { id: idDesdeEtiqueta("columna", new Set(cols.map((c) => c.id))), titulo: "Nueva columna", tipo: "texto" }])}
        className="inline-flex items-center gap-1 text-xs font-medium text-cdmb-700 hover:underline"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Agregar columna
      </button>
      {campo.filasIniciales?.length ? <p className="text-[11px] text-stone-400">La tabla trae {campo.filasIniciales.length} fila(s) prellenadas.</p> : null}
    </div>
  );
}
