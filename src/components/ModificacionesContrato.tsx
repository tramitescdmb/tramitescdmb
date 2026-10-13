"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, FilePlus2, UploadCloud, X } from "lucide-react";
import { comprimirParaContratacion } from "@/lib/compresion-cliente";
import { subirArchivoContrato, sha256Hex } from "@/lib/uploads-client";
import { TAMANO_MAXIMO_CONTRATACION_BYTES, mensajeArchivoDemasiadoGrandeContratacion } from "@/lib/uploads-config";
import {
  ETIQUETA_TIPO_MODIFICACION,
  LIMITE_ADICION,
  TIPOS_MODIFICACION,
  cambiaPlazo,
  cambiaValor,
  diasSuspendidos,
  duracionPeriodo,
  errorModificacion,
  leerModificacion,
  nuevaFechaTerminacion,
  periodosRequeridos,
  textoAnios,
  CLASES_VIGENCIAS_FUTURAS,
  type TipoModificacion,
} from "@/lib/modificaciones-contrato";

export type ModificacionRegistrada = {
  id: string;
  numero: number;
  tipo: TipoModificacion;
  terminacionAnterior: string | null;
  terminacionNueva: string | null;
  valorAdicionado: number | null;
  vigenciasFuturas: boolean;
  aniosVigenciasFuturas: number[];
  actoVigenciasFuturas: string | null;
  valoresVigenciasFuturas: { anio: number; valor: number; desde?: string; hasta?: string }[];
  observacion: string | null;
  documentoId: string | null;
  registradoEn: string;
  registradoPor: string;
};

const pesos = (v: number) => `$ ${Math.round(v).toLocaleString("es-CO")}`;
const fechaLarga = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const campo = "rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";

export function ModificacionesContrato({
  expedienteId,
  puedeRegistrar,
  terminacion,
  valorInicial,
  modificaciones,
}: {
  expedienteId: string;
  puedeRegistrar: boolean;
  terminacion: string | null;
  valorInicial: number | null;
  modificaciones: ModificacionRegistrada[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoModificacion | "">("");
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
            fechaTerminacion,
            valorAdicionado: Number(valorAdicionado),
            fechaSuspension,
            fechaReinicio,
            vigenciasFuturas: { clase: vfClase, acto: vfActo, hasta: vfHasta, valores: Object.entries(vfValores).map(([anio, valor]) => ({ anio: Number(anio), valor: Number(valor) })) },
            observacion,
          })
        : null,
    [tipo, fechaTerminacion, valorAdicionado, fechaSuspension, fechaReinicio, vfClase, vfActo, vfHasta, vfValores, observacion]
  );
  const nueva = datos ? nuevaFechaTerminacion(datos, actual) : null;
  const periodos = datos ? periodosRequeridos(datos, actual) : [];
  const anios = periodos.map((p) => p.anio);
  const pideVigencias = tipo === "VIGENCIAS_FUTURAS" || periodos.length > 0;
  const disponibleAdicion = valorInicial !== null ? valorInicial * LIMITE_ADICION - adicionadoPrevio : null;

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
    const problema = errorModificacion(datos, { terminacion: actual, valorInicial, adicionadoPrevio });
    if (problema) return setError(problema);
    if (!archivo) return setError("Cargue el acta de la modificación.");
    setGuardando(true);
    setError(null);
    try {
      const comprimido = await comprimirParaContratacion(archivo);
      if (comprimido.size > TAMANO_MAXIMO_CONTRATACION_BYTES) throw new Error(mensajeArchivoDemasiadoGrandeContratacion(archivo.name));
      const subido = await subirArchivoContrato(expedienteId, comprimido);
      const res = await fetch(`/api/contratacion/expedientes/${expedienteId}/modificaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modificacion: datos,
          requiereFirma,
          archivo: { storagePath: subido.path, mimeType: subido.mimeType, tamanoBytes: subido.tamanoBytes, hashSha256: await sha256Hex(comprimido) },
        }),
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
    <section id="modificaciones" className="scroll-mt-28 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
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
          </p>
        </div>
        {puedeRegistrar && !abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-acento-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-acento-600"
          >
            <FilePlus2 className="h-4 w-4" aria-hidden />
            Registrar modificación
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-4 space-y-4 rounded-xl border border-acento-200 bg-acento-50/40 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-stone-900">Nueva modificación (N.° {modificaciones.length + 1})</p>
            <button type="button" onClick={cerrar} className="text-stone-400 hover:text-stone-700" title="Cancelar">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <fieldset>
            <legend className="mb-2 text-xs font-medium text-stone-700">1. Tipo de modificación</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TIPOS_MODIFICACION.map((t) => (
                <label
                  key={t.valor}
                  className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-xs transition ${
                    tipo === t.valor ? "border-acento-500 bg-white ring-1 ring-acento-500" : "border-stone-200 bg-white hover:border-acento-300"
                  }`}
                >
                  <span className="flex items-center gap-2 font-semibold text-stone-900">
                    <input type="radio" name="tipo-modificacion" checked={tipo === t.valor} onChange={() => elegirTipo(t.valor)} className="accent-acento-500" />
                    {t.etiqueta}
                  </span>
                  <span className="text-stone-500">{t.descripcion}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {tipo && (
            <fieldset className="space-y-3">
              <legend className="mb-2 text-xs font-medium text-stone-700">2. Datos</legend>
              <div className="flex flex-wrap gap-4">
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
                    {disponibleAdicion !== null && <span className="text-[11px] text-stone-400">Disponible hasta el 50 %: {pesos(Math.max(0, disponibleAdicion))}</span>}
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
                <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-white px-3 py-2 text-xs text-stone-600">
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
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-950">
                  <p className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-600" aria-hidden />
                    {tipo === "VIGENCIAS_FUTURAS"
                      ? "Registre la autorización para comprometer recursos de la vigencia siguiente, por el periodo que el contrato se ejecuta en ella."
                      : `La nueva terminación compromete la vigencia ${textoAnios(anios)}. No se registra sin la autorización de vigencias futuras.`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CLASES_VIGENCIAS_FUTURAS.map((c) => (
                      <label
                        key={c.valor}
                        className={`flex cursor-pointer flex-col rounded-lg border bg-white px-3 py-2 ${vfClase === c.valor ? "border-amber-500 ring-1 ring-amber-500" : "border-amber-200"}`}
                      >
                        <span className="flex items-center gap-2 font-semibold">
                          <input type="radio" name="clase-vf" checked={vfClase === c.valor} onChange={() => setVfClase(c.valor)} className="accent-amber-600" />
                          {c.etiqueta}
                        </span>
                        <span className="text-amber-800/80">{c.descripcion}</span>
                      </label>
                    ))}
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
              <legend className="mb-2 text-xs font-medium text-stone-700">3. Acta de la modificación</legend>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50">
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
              className="rounded-lg bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
            >
              {guardando ? "Registrando…" : "Registrar modificación"}
            </button>
          )}
        </div>
      )}

      {modificaciones.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-stone-100">
          <table className="w-full text-xs">
            <thead className="bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-400">
              <tr>
                <th className="px-3 py-2 font-medium">N.°</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Terminación</th>
                <th className="px-3 py-2 font-medium">Valor adicionado</th>
                <th className="px-3 py-2 font-medium">Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {modificaciones.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2 font-medium text-stone-800">{m.numero}</td>
                  <td className="px-3 py-2 text-stone-700">
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
                  <td className="px-3 py-2 text-stone-600">
                    {m.terminacionNueva ? `${fechaLarga(m.terminacionAnterior)} → ${fechaLarga(m.terminacionNueva)}` : "Sin cambio"}
                  </td>
                  <td className="px-3 py-2 text-stone-600">{m.valorAdicionado ? pesos(m.valorAdicionado) : "—"}</td>
                  <td className="px-3 py-2 text-stone-400">
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
