"use client";

import { useMemo, useState } from "react";
import { formatearSmmlv } from "@/lib/smmlv";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, Check, FilePlus2, UploadCloud, X } from "lucide-react";
import { comprimirParaContratacion } from "@/lib/compresion-cliente";
import { subirArchivoContrato, sha256Hex } from "@/lib/uploads-client";
import { TAMANO_MAXIMO_CONTRATACION_BYTES, mensajeArchivoDemasiadoGrandeContratacion } from "@/lib/uploads-config";
import {
  ETIQUETA_TIPO_MODIFICACION,
  TIPOS_MODIFICACION,
  cambiaPlazo,
  cambiaValor,
  diasSuspendidos,
  exentoLimiteAdicion,
  limiteAdicion,
  duracionPeriodo,
  errorModificacion,
  leerModificacion,
  nuevaFechaTerminacion,
  periodosRequeridos,
  textoAnios,
  CLASES_VIGENCIAS_FUTURAS,
  SOPORTES_PRESUPUESTALES,
  MOTIVO_SIN_CDP,
  soportesRequeridos,
  type SoportePresupuestal,
  type TipoModificacion,
} from "@/lib/modificaciones-contrato";

export type ModificacionRegistrada = {
  id: string;
  numero: number;
  tipo: TipoModificacion;
  fecha: string;
  terminacionAnterior: string | null;
  terminacionNueva: string | null;
  valorAdicionado: number | null;
  vigenciasFuturas: boolean;
  aniosVigenciasFuturas: number[];
  actoVigenciasFuturas: string | null;
  valoresVigenciasFuturas: { anio: number; valor: number; desde?: string; hasta?: string }[];
  observacion: string | null;
  documentoId: string | null;
  cdpDocumentoId: string | null;
  rpDocumentoId: string | null;
  registradoEn: string;
  registradoPor: string;
};

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
  terminacion,
  inicio,
  suscripcion,
  tipoContrato,
  valorInicial,
  modificaciones,
}: {
  expedienteId: string;
  puedeRegistrar: boolean;
  terminacion: string | null;
  inicio: string | null;
  suscripcion: string | null;
  tipoContrato: string;
  valorInicial: number | null;
  modificaciones: ModificacionRegistrada[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoModificacion | "">("");
  const [fecha, setFecha] = useState(() => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10));
  const [fechaTerminacion, setFechaTerminacion] = useState("");
  const [valorAdicionado, setValorAdicionado] = useState("");
  const [fechaSuspension, setFechaSuspension] = useState("");
  const [fechaReinicio, setFechaReinicio] = useState("");
  const [vfClase, setVfClase] = useState("");
  const [vfActo, setVfActo] = useState("");
  const [vfHasta, setVfHasta] = useState("");
  const [vfValores, setVfValores] = useState<Record<number, string>>({});
  const [observacion, setObservacion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [requiereFirma, setRequiereFirma] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adicionadoPrevio = modificaciones.reduce((a, m) => a + (m.valorAdicionado ?? 0), 0);
  const actual = terminacion ? new Date(`${terminacion}T00:00:00Z`) : null;
  const datos = useMemo(
    () =>
      tipo
        ? leerModificacion({
            tipo,
            fecha,
            fechaTerminacion,
            valorAdicionado: Number(valorAdicionado),
            fechaSuspension,
            fechaReinicio,
            vigenciasFuturas: { clase: vfClase, acto: vfActo, hasta: vfHasta, valores: Object.entries(vfValores).map(([anio, valor]) => ({ anio: Number(anio), valor: Number(valor) })) },
            observacion,
          })
        : null,
    [tipo, fecha, fechaTerminacion, valorAdicionado, fechaSuspension, fechaReinicio, vfClase, vfActo, vfHasta, vfValores, observacion]
  );
  const nueva = datos ? nuevaFechaTerminacion(datos, actual) : null;
  const periodos = datos ? periodosRequeridos(datos, actual) : [];
  const anios = periodos.map((p) => p.anio);
  const pideVigencias = tipo === "VIGENCIAS_FUTURAS" || periodos.length > 0;
  const soportesPendientes = modificaciones.reduce(
    (a, m) => a + soportesRequeridos(m).filter((x) => !(x === "CDP" ? m.cdpDocumentoId : m.rpDocumentoId)).length,
    0
  );
  const conSoportes = modificaciones.some((m) => soportesRequeridos(m).length > 0);
  const soportesNueva = datos ? soportesRequeridos({ tipo: datos.tipo, vigenciasFuturas: pideVigencias }) : [];
  const tipoElegido = TIPOS_MODIFICACION.find((t) => t.valor === tipo);
  const contrato = {
    terminacion: actual,
    inicio: inicio ? new Date(`${inicio}T00:00:00Z`) : null,
    suscripcion: suscripcion ? new Date(`${suscripcion}T00:00:00Z`) : null,
    valorInicial,
    tipoContrato,
    adiciones: modificaciones.filter((m) => m.valorAdicionado).map((m) => ({ valor: m.valorAdicionado!, fecha: new Date(m.fecha) })),
  };
  const limite = fecha ? limiteAdicion(contrato, new Date(`${fecha}T00:00:00Z`)) : null;

  function cerrar() {
    setAbierto(false);
    setTipo("");
    setFechaTerminacion("");
    setValorAdicionado("");
    setFechaSuspension("");
    setFechaReinicio("");
    setVfClase("");
    setVfActo("");
    setVfHasta("");
    setVfValores({});
    setObservacion("");
    setArchivo(null);
    setError(null);
  }

  function elegirTipo(t: TipoModificacion) {
    setTipo(t);
    if (t === "VIGENCIAS_FUTURAS" && !vfHasta && terminacion && Number(terminacion.slice(0, 4)) > new Date().getFullYear()) setVfHasta(terminacion.slice(0, 10));
  }

  async function registrar() {
    if (!datos) return setError("Seleccione el tipo de modificación.");
    const problema = errorModificacion(datos, contrato);
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
            Terminación vigente: <strong className="text-stone-800">{fechaLarga(terminacion)}</strong>
            {valorInicial !== null && (
              <>
                {" "}· Valor: <strong className="text-stone-800">{pesos(valorInicial + adicionadoPrevio)}</strong>
                {adicionadoPrevio > 0 && <span className="text-stone-400"> (inicial {pesos(valorInicial)})</span>}
              </>
            )}
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
                  <input type="radio" name="tipo-modificacion" checked={tipo === t.valor} onChange={() => elegirTipo(t.valor)} className="sr-only" />
                  {t.etiqueta}
                </label>
              ))}
            </div>
            {tipoElegido && <p className="mt-1 text-[11px] text-stone-500">{tipoElegido.descripcion}</p>}
          </fieldset>

          {tipo && (
            <fieldset className="space-y-2">
              <legend className="mb-1.5 text-xs font-medium text-stone-700">2. Datos</legend>
              <div className="flex flex-wrap gap-3">
                <label className="flex flex-col gap-1 text-xs text-stone-600">
                  Fecha de suscripción
                  <input type="date" value={fecha} min={inicio ?? undefined} max={terminacion ?? undefined} onChange={(e) => setFecha(e.target.value)} className={campo} />
                </label>
                {cambiaPlazo(tipo) && (
                  <label className="flex flex-col gap-1 text-xs text-stone-600">
                    Nueva fecha de terminación
                    <input type="date" value={fechaTerminacion} min={terminacion ?? undefined} onChange={(e) => setFechaTerminacion(e.target.value)} className={campo} />
                  </label>
                )}
                {cambiaValor(tipo) && (
                  <label className="flex flex-col gap-1 text-xs text-stone-600">
                    Valor adicionado ($)
                    <input type="number" min={1} step={1} value={valorAdicionado} onChange={(e) => setValorAdicionado(e.target.value)} className={`${campo} w-48`} />
                    {limite ? (
                      <span className="text-[11px] text-stone-400" title={`50 % del valor inicial: ${formatearSmmlv(limite.inicialSm / 2)}; adicionado: ${formatearSmmlv(limite.adicionadoSm)}`}>
                        Disponible hasta el 50 %: {formatearSmmlv(limite.disponibleSm)} ≈ {pesos(limite.disponiblePesos)} (SMMLV {limite.anioAdicion})
                      </span>
                    ) : (
                      exentoLimiteAdicion(tipoContrato) && <span className="text-[11px] text-stone-400">Interventoría: sin el límite del 50 % (Ley 1474 de 2011, art. 85)</span>
                    )}
                  </label>
                )}
                {tipo === "SUSPENSION" && (
                  <>
                    <label className="flex flex-col gap-1 text-xs text-stone-600">
                      Fecha de suspensión
                      <input type="date" value={fechaSuspension} onChange={(e) => setFechaSuspension(e.target.value)} className={campo} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-stone-600">
                      Fecha de reinicio
                      <input type="date" value={fechaReinicio} min={fechaSuspension || undefined} onChange={(e) => setFechaReinicio(e.target.value)} className={campo} />
                    </label>
                  </>
                )}
                <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs text-stone-600">
                  {tipo === "OTRA" ? "Descripción de la modificación" : "Observación (opcional)"}
                  <input value={observacion} onChange={(e) => setObservacion(e.target.value)} maxLength={1000} className={campo} />
                </label>
              </div>

              {(nueva || (datos?.valorAdicionado && valorInicial !== null)) && (
                <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-md bg-white px-2.5 py-1.5 text-xs text-stone-600">
                  {nueva && (
                    <span>
                      Terminación: {fechaLarga(terminacion)} → <strong className="text-stone-900">{fechaLarga(nueva.toISOString())}</strong>
                      {tipo === "SUSPENSION" && datos && <span className="text-stone-400"> ({diasSuspendidos(datos)} día(s) suspendidos)</span>}
                    </span>
                  )}
                  {datos?.valorAdicionado && valorInicial !== null ? (
                    <span>
                      Valor: {pesos(valorInicial + adicionadoPrevio)} → <strong className="text-stone-900">{pesos(valorInicial + adicionadoPrevio + datos.valorAdicionado)}</strong>
                    </span>
                  ) : null}
                </div>
              )}

              {pideVigencias && (
                <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  <p className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-px h-3.5 w-3.5 flex-none text-amber-600" aria-hidden />
                    {tipo === "VIGENCIAS_FUTURAS"
                      ? "Registre la autorización para comprometer recursos de la vigencia siguiente, por el periodo que el contrato se ejecuta en ella."
                      : `La nueva terminación compromete la vigencia ${textoAnios(anios)}. No se registra sin la autorización de vigencias futuras.`}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>Clase:</span>
                    {CLASES_VIGENCIAS_FUTURAS.map((c) => (
                      <label
                        key={c.valor}
                        title={c.descripcion}
                        className={`flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium ${
                          vfClase === c.valor ? "border-amber-500 bg-amber-500 text-white" : "border-amber-300 bg-white text-amber-900"
                        }`}
                      >
                        <input type="radio" name="clase-vf" checked={vfClase === c.valor} onChange={() => setVfClase(c.valor)} className="sr-only" />
                        {c.etiqueta}
                      </label>
                    ))}
                    {vfClase && <span className="text-amber-800/80">{CLASES_VIGENCIAS_FUTURAS.find((c) => c.valor === vfClase)?.descripcion}</span>}
                  </div>
                  <label className="flex flex-col gap-1">
                    Acto de autorización (número y fecha)
                    <input value={vfActo} onChange={(e) => setVfActo(e.target.value)} placeholder="Ej. Acuerdo del Consejo Directivo N.° 012 del 20 de noviembre de 2026" className={campo} />
                  </label>
                  {tipo === "VIGENCIAS_FUTURAS" && (
                    <label className="flex flex-col gap-1">
                      Ejecución en la vigencia siguiente hasta
                      <input type="date" value={vfHasta} min={`${new Date().getFullYear() + 1}-01-01`} onChange={(e) => setVfHasta(e.target.value)} className={`${campo} w-48`} />
                    </label>
                  )}
                  {periodos.length > 0 && (
                    <div>
                      <p className="mb-1">Periodo y valor comprometido en cada vigencia</p>
                      <div className="flex flex-wrap items-end gap-3">
                        {periodos.map((p) => (
                          <label key={p.anio} className="flex flex-col gap-1">
                            <span>
                              <strong>{p.anio}</strong> · {fechaLarga(p.desde)} – {fechaLarga(p.hasta)}{" "}
                              <span className="text-amber-800/80">({duracionPeriodo(p.desde, p.hasta)})</span>
                            </span>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              placeholder="Valor ($)"
                              value={vfValores[p.anio] ?? ""}
                              onChange={(e) => setVfValores((v) => ({ ...v, [p.anio]: e.target.value }))}
                              className={`${campo} w-48`}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </fieldset>
          )}

          {tipo && (
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-stone-700">3. Acta de la modificación</legend>
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
              {soportesNueva.length > 0 && (
                <p className="mt-1.5 text-[11px] text-stone-500">
                  Una vez registrada, cargue en la tabla {soportesNueva.length === 2 ? "el CDP y el RP" : "el RP"} de esta modificación.
                  {soportesNueva.length === 1 && " No requiere CDP: los recursos de la vigencia siguiente se respaldan con el acto de autorización."}
                </p>
              )}
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
                <th className="px-3 py-1.5 font-medium">Terminación</th>
                <th className="px-3 py-1.5 font-medium">Valor adicionado</th>
                {conSoportes && <th className="px-3 py-1.5 font-medium">CDP / RP</th>}
                <th className="px-3 py-1.5 font-medium">Suscripción</th>
                <th className="px-3 py-1.5 font-medium">Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {modificaciones.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-1.5 font-medium text-stone-800">{m.numero}</td>
                  <td className="px-3 py-1.5 text-stone-700">
                    {ETIQUETA_TIPO_MODIFICACION[m.tipo]}
                    {m.vigenciasFuturas && (
                      <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] text-amber-700">vigencias futuras {textoAnios(m.aniosVigenciasFuturas)}</span>
                    )}
                    {m.actoVigenciasFuturas && <span className="block text-stone-400">{m.actoVigenciasFuturas}</span>}
                    {m.valoresVigenciasFuturas.length > 0 && (
                      <span className="block text-stone-400">{m.valoresVigenciasFuturas
                          .map((v) => `${v.anio}${v.desde && v.hasta ? ` (${fechaLarga(v.desde)} – ${fechaLarga(v.hasta)}, ${duracionPeriodo(v.desde, v.hasta)})` : ""}: ${pesos(v.valor)}`)
                          .join(" · ")}</span>
                    )}
                    {m.observacion && <span className="block text-stone-400">{m.observacion}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-stone-600">
                    {m.terminacionNueva ? `${fechaLarga(m.terminacionAnterior)} → ${fechaLarga(m.terminacionNueva)}` : "Sin cambio"}
                  </td>
                  <td className="px-3 py-1.5 text-stone-600">{m.valorAdicionado ? pesos(m.valorAdicionado) : "—"}</td>
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
                  <td className="whitespace-nowrap px-3 py-1.5 text-stone-600">{fechaLarga(m.fecha)}</td>
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
    </section>
  );
}
