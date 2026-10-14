"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, Check, FilePlus2, UploadCloud, X } from "lucide-react";
import { comprimirParaContratacion } from "@/lib/compresion-cliente";
import { subirArchivoContrato, sha256Hex } from "@/lib/uploads-client";
import { TAMANO_MAXIMO_CONTRATACION_BYTES, mensajeArchivoDemasiadoGrandeContratacion } from "@/lib/uploads-config";
import {
  ETIQUETA_TIPO_MODIFICACION,
  TIPOS_MODIFICACION,
  CLASES_TERMINACION,
  SOPORTES_PRESUPUESTALES,
  MOTIVO_SIN_CDP,
  errorModificacion,
  leerModificacion,
  soportesRequeridos,
  type SoportePresupuestal,
  type TipoModificacion,
} from "@/lib/modificaciones-contrato";

export type ModificacionRegistrada = {
  id: string;
  numero: number;
  tipo: TipoModificacion;
  fecha: string;
  claseTerminacion: string | null;
  observacion: string | null;
  documentoId: string | null;
  cdpDocumentoId: string | null;
  rpDocumentoId: string | null;
  registradoEn: string;
  registradoPor: string;
};

export type ModificacionSecop = { proposito: string; fecha: string | null; dias: number | null; valor: number | null; estado: string | null };

const pesos = (v: number) => `$ ${Math.round(v).toLocaleString("es-CO")}`;
const fechaLarga = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const campo = "rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";

async function subirAlExpediente(expedienteId: string, archivo: File) {
  const comprimido = await comprimirParaContratacion(archivo);
  if (comprimido.size > TAMANO_MAXIMO_CONTRATACION_BYTES) throw new Error(mensajeArchivoDemasiadoGrandeContratacion(archivo.name));
  const subido = await subirArchivoContrato(expedienteId, comprimido);
  return { storagePath: subido.path, mimeType: subido.mimeType, tamanoBytes: subido.tamanoBytes, hashSha256: await sha256Hex(comprimido) };
}

function SoporteCelda({
  expedienteId,
  modificacionId,
  soporte,
  documentoId,
  puedeCargar,
}: {
  expedienteId: string;
  modificacionId: string;
  soporte: SoportePresupuestal;
  documentoId: string | null;
  puedeCargar: boolean;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nombre = SOPORTES_PRESUPUESTALES.find((x) => x.valor === soporte)!.nombre;

  if (documentoId) {
    return (
      <a href={`#documento-${documentoId}`} title={`${nombre}: ver documento`} className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-px font-medium text-emerald-700 hover:bg-emerald-100">
        <Check className="h-3 w-3" aria-hidden />
        {soporte}
      </a>
    );
  }
  if (!puedeCargar) {
    return (
      <span title={`${nombre} pendiente`} className="rounded bg-amber-50 px-1.5 py-px font-medium text-amber-700">
        {soporte} pendiente
      </span>
    );
  }

  async function cargar(archivo: File) {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}/modificaciones/${modificacionId}/presupuesto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soporte, archivo: await subirAlExpediente(expedienteId, archivo) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo cargar el soporte.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <label
      title={error ?? `Cargar ${nombre}`}
      className={`inline-flex cursor-pointer items-center gap-0.5 rounded border px-1.5 py-px font-medium ${
        error ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
      }`}
    >
      <UploadCloud className="h-3 w-3" aria-hidden />
      {cargando ? "Cargando…" : soporte}
      <input
        type="file"
        className="hidden"
        disabled={cargando}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void cargar(f);
        }}
      />
    </label>
  );
}

export function ModificacionesContrato({
  expedienteId,
  puedeRegistrar,
  modificaciones,
  modificacionesSecop,
  enlazadoSecop,
}: {
  expedienteId: string;
  puedeRegistrar: boolean;
  modificaciones: ModificacionRegistrada[];
  modificacionesSecop: ModificacionSecop[];
  enlazadoSecop: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoModificacion | "">("");
  const [fecha, setFecha] = useState(() => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10));
  const [claseTerminacion, setClaseTerminacion] = useState("");
  const [observacion, setObservacion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [requiereFirma, setRequiereFirma] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipoElegido = TIPOS_MODIFICACION.find((t) => t.valor === tipo);
  const soportesNueva = tipo ? soportesRequeridos({ tipo }) : [];
  const conSoportes = modificaciones.some((m) => soportesRequeridos(m).length > 0);
  const soportesPendientes = modificaciones.reduce(
    (a, m) => a + soportesRequeridos(m).filter((x) => !(x === "CDP" ? m.cdpDocumentoId : m.rpDocumentoId)).length,
    0
  );
  const sinActa = Math.max(0, modificacionesSecop.length - modificaciones.length);

  function cerrar() {
    setAbierto(false);
    setTipo("");
    setClaseTerminacion("");
    setObservacion("");
    setArchivo(null);
    setError(null);
  }

  async function registrar() {
    const datos = tipo ? leerModificacion({ tipo, fecha, claseTerminacion, observacion }) : null;
    if (!datos) return setError("Seleccione el tipo de modificación.");
    const problema = errorModificacion(datos);
    if (problema) return setError(problema);
    if (!archivo) return setError("Cargue el acta de la modificación.");
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}/modificaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modificacion: datos, requiereFirma, archivo: await subirAlExpediente(expedienteId, archivo) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo registrar la modificación.");
      cerrar();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section id="modificaciones" className="scroll-mt-28 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <CalendarClock className="h-4 w-4 text-acento-600" aria-hidden />
            Modificaciones del contrato
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">{modificaciones.length}</span>
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Registro de las actas para su custodia y firma.
            {enlazadoSecop && " El plazo y el valor vigentes se actualizan desde SECOP II."}
            {soportesPendientes > 0 && <span className="font-medium text-amber-700"> · {soportesPendientes} soporte(s) presupuestal(es) por cargar</span>}
          </p>
        </div>
        {puedeRegistrar && !abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600"
          >
            <FilePlus2 className="h-4 w-4" aria-hidden />
            Registrar modificación
          </button>
        )}
      </div>

      {sinActa > 0 && (
        <p className="mt-3 flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          <AlertTriangle className="mt-px h-3.5 w-3.5 flex-none text-amber-600" aria-hidden />
          SECOP II reporta {modificacionesSecop.length} modificación(es) y en GECON hay {modificaciones.length} acta(s): registre aquí el acta de cada una para
          custodiarla en el expediente.
        </p>
      )}

      {abierto && (
        <div className="mt-3 space-y-3 rounded-lg border border-acento-200 bg-acento-50/40 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-stone-900">Nueva modificación (N.° {modificaciones.length + 1})</p>
            <button type="button" onClick={cerrar} className="text-stone-400 hover:text-stone-700" title="Cancelar">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-stone-700">1. Tipo de modificación</legend>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_MODIFICACION.map((t) => (
                <label
                  key={t.valor}
                  title={t.descripcion}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                    tipo === t.valor ? "border-acento-500 bg-acento-500 text-white" : "border-stone-200 bg-white text-stone-700 hover:border-acento-300"
                  }`}
                >
                  <input type="radio" name="tipo-modificacion" checked={tipo === t.valor} onChange={() => setTipo(t.valor)} className="sr-only" />
                  {t.etiqueta}
                </label>
              ))}
            </div>
            {tipoElegido && <p className="mt-1 text-[11px] text-stone-500">{tipoElegido.descripcion}</p>}
          </fieldset>

          {tipo && (
            <fieldset className="space-y-2">
              <legend className="mb-1.5 text-xs font-medium text-stone-700">2. Datos del acta</legend>
              <div className="flex flex-wrap gap-3">
                <label className="flex flex-col gap-1 text-xs text-stone-600">
                  Fecha de suscripción
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} />
                </label>
                {tipo === "TERMINACION_ANTICIPADA" && (
                  <div className="flex flex-col gap-1 text-xs text-stone-600">
                    Clase de terminación
                    <div className="flex gap-1.5">
                      {CLASES_TERMINACION.map((c) => (
                        <label
                          key={c.valor}
                          title={c.descripcion}
                          className={`cursor-pointer rounded-full border px-2.5 py-1 font-medium ${
                            claseTerminacion === c.valor ? "border-acento-500 bg-acento-500 text-white" : "border-stone-200 bg-white text-stone-700"
                          }`}
                        >
                          <input type="radio" name="clase-terminacion" checked={claseTerminacion === c.valor} onChange={() => setClaseTerminacion(c.valor)} className="sr-only" />
                          {c.etiqueta}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs text-stone-600">
                  {tipo === "OTRA" ? "Descripción de la modificación" : "Observación (opcional)"}
                  <input value={observacion} onChange={(e) => setObservacion(e.target.value)} maxLength={1000} className={campo} />
                </label>
              </div>
              {soportesNueva.length > 0 && (
                <p className="text-[11px] text-stone-500">
                  Una vez registrada, cargue en la tabla {soportesNueva.length === 2 ? "el CDP y el RP" : "el RP"} de esta modificación.
                </p>
              )}
            </fieldset>
          )}

          {tipo && (
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-stone-700">3. Acta</legend>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
                  <UploadCloud className="h-4 w-4" aria-hidden />
                  {archivo ? archivo.name : "Elegir archivo"}
                  <input type="file" className="hidden" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-stone-600">
                  <input type="checkbox" checked={requiereFirma} onChange={(e) => setRequiereFirma(e.target.checked)} />
                  Requiere firma
                </label>
              </div>
            </fieldset>
          )}

          {error && <p className="text-xs text-red-700">{error}</p>}
          {tipo && (
            <button
              type="button"
              onClick={registrar}
              disabled={guardando}
              className="rounded-lg bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
            >
              {guardando ? "Registrando…" : "Registrar modificación"}
            </button>
          )}
        </div>
      )}

      {modificaciones.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-stone-100">
          <table className="w-full text-xs">
            <thead className="bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-400">
              <tr>
                <th className="px-3 py-1.5 font-medium">N.°</th>
                <th className="px-3 py-1.5 font-medium">Tipo</th>
                <th className="px-3 py-1.5 font-medium">Suscripción</th>
                {conSoportes && <th className="px-3 py-1.5 font-medium">CDP / RP</th>}
                <th className="px-3 py-1.5 font-medium">Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {modificaciones.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-1.5 font-medium text-stone-800">{m.numero}</td>
                  <td className="px-3 py-1.5 text-stone-700">
                    {ETIQUETA_TIPO_MODIFICACION[m.tipo]}
                    {m.claseTerminacion && <span className="text-stone-400"> · {CLASES_TERMINACION.find((c) => c.valor === m.claseTerminacion)?.etiqueta.toLowerCase()}</span>}
                    {m.observacion && <span className="block text-stone-400">{m.observacion}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-stone-600">{fechaLarga(m.fecha)}</td>
                  {conSoportes && (
                    <td className="whitespace-nowrap px-3 py-1.5 text-[11px]">
                      {soportesRequeridos(m).length > 0 ? (
                        <span className="flex gap-1">
                          {SOPORTES_PRESUPUESTALES.map((x) =>
                            !soportesRequeridos(m).includes(x.valor) ? (
                              <span key={x.valor} title={MOTIVO_SIN_CDP} className="rounded px-1.5 py-px text-stone-300">
                                Sin {x.valor}
                              </span>
                            ) : (
                              <SoporteCelda
                                key={x.valor}
                                expedienteId={expedienteId}
                                modificacionId={m.id}
                                soporte={x.valor}
                                documentoId={x.valor === "CDP" ? m.cdpDocumentoId : m.rpDocumentoId}
                                puedeCargar={puedeRegistrar}
                              />
                            )
                          )}
                        </span>
                      ) : (
                        <span className="text-stone-300">No aplica</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-1.5 text-stone-400">
                    {fechaLarga(m.registradoEn)} · {m.registradoPor}
                    {m.documentoId && (
                      <a href={`#documento-${m.documentoId}`} className="ml-1 text-cdmb-700 hover:underline">
                        Ver acta
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modificacionesSecop.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Publicadas en SECOP II</p>
          <ul className="space-y-0.5 text-xs text-stone-600">
            {modificacionesSecop.map((m, i) => (
              <li key={i}>
                {fechaLarga(m.fecha)} · {m.proposito}
                {m.dias ? ` · ${m.dias} día(s)` : ""}
                {m.valor ? ` · ${pesos(m.valor)}` : ""}
                {m.estado ? <span className="text-stone-400"> · {m.estado}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
