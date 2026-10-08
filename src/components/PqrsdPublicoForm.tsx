"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Upload, X, CheckCircle2, ListChecks, UserRound, MessageSquareText, Paperclip } from "lucide-react";
import { EncabezadoPaso } from "@/components/sgdea/EncabezadoPaso";
import { subirArchivoPublico, subirDocumentosConProgreso } from "@/lib/uploads-client";
import { ACCEPT_DOCUMENTOS } from "@/lib/uploads-config";
import { filtrarLoteSGDEA, MAX_ARCHIVOS_LOTE, TAMANO_MAXIMO_SGDEA_MB } from "@/lib/uploads-sgdea";
import { Field, SectionHelp } from "@/components/Field";
import { CamposPersona } from "@/components/CamposPersona";
import { nombreCompletoPersona, personaVacia, type DatosPersona } from "@/lib/datos-persona";
import { BarraProgresoEnvio } from "@/components/BarraProgresoEnvio";
import { BotonImprimir } from "@/components/BotonImprimir";
import { formatearFechaLarga } from "@/lib/fecha";

const TIPOS_PQRSD = [
  { value: "PETICION_GENERAL", label: "Petición", ayuda: "Pide que la CDMB haga algo o le entregue información. Responde en 15 días hábiles." },
  { value: "PETICION_DOCUMENTOS", label: "Petición de copia de documentos", ayuda: "Pide copia de un documento específico que tenga la CDMB. Responde en 10 días hábiles." },
  { value: "CONSULTA", label: "Consulta", ayuda: "Pregunta sobre un tema de competencia de la CDMB, sin pedir un trámite puntual. Responde en 30 días hábiles." },
  { value: "QUEJA", label: "Queja", ayuda: "Manifiesta inconformidad con la conducta de un servidor de la CDMB. Responde en 15 días hábiles." },
  { value: "RECLAMO", label: "Reclamo", ayuda: "Exige que se corrija o se cumpla algo que no se hizo bien. Responde en 15 días hábiles." },
  { value: "SUGERENCIA", label: "Sugerencia", ayuda: "Propone una idea o mejora para la entidad. Responde en 15 días hábiles." },
  { value: "DENUNCIA", label: "Denuncia", ayuda: "Pone en conocimiento un posible hecho irregular. Responde en 15 días hábiles." },
];
export function PqrsdPublicoForm() {
  const [tsCarga] = useState(() => Date.now());
  const [anonima, setAnonima] = useState(false);
  const [tipoPqrsd, setTipoPqrsd] = useState("");
  const [persona, setPersona] = useState<DatosPersona>(personaVacia());
  const [asunto, setAsunto] = useState("");
  const [contenido, setContenido] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [sitioWeb, setSitioWeb] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<{ pct: number; texto: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ radicado: string; fechaVencimiento: string | null; codigoSeguimiento?: string | null } | null>(null);

  const ayudaTipo = TIPOS_PQRSD.find((t) => t.value === tipoPqrsd)?.ayuda;

  function agregarArchivos(lista: FileList | null) {
    if (!lista) return;
    const { validos, error: err } = filtrarLoteSGDEA(Array.from(lista), archivos.length);
    if (err) setError(err);
    if (validos.length) setArchivos((prev) => [...prev, ...validos]);
  }

  async function enviar() {
    setError(null);
    if (!tipoPqrsd) return setError("Seleccione el tipo de solicitud.");
    if (!asunto.trim()) return setError("El asunto es obligatorio.");
    if (!contenido.trim()) return setError("Describa su solicitud.");
    if (!anonima) {
      if (!nombreCompletoPersona(persona)) return setError("El nombre o razón social es obligatorio.");
      if (!persona.identificacion.trim()) return setError("La identificación es obligatoria.");
      if (!persona.departamento.trim() || !persona.ciudad.trim()) return setError("Indique su departamento y su ciudad.");
      if (!persona.email.trim() && !persona.celular.trim() && !persona.telefono.trim()) {
        return setError("Indique al menos un medio de contacto (correo, celular o teléfono).");
      }
    }

    setEnviando(true);
    setProgreso({ pct: 0, texto: "Preparando…" });
    try {
      const folder = crypto.randomUUID();
      const documentos = await subirDocumentosConProgreso(archivos, subirArchivoPublico, folder, (pct, texto) => setProgreso({ pct, texto }));

      const resp = await fetch("/api/pqrsd/radicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoPqrsd,
          asunto: asunto.trim(),
          contenido: contenido.trim(),
          anonima,
          tercero: anonima ? null : persona,
          documentos,
          tsCarga,
          sitioWeb,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudo radicar la solicitud.");
      setProgreso({ pct: 100, texto: "Listo." });
      setResultado({ radicado: data.radicado, fechaVencimiento: data.fechaVencimiento ?? null, codigoSeguimiento: data.codigoSeguimiento ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo radicar la solicitud.");
      setProgreso(null);
    } finally {
      setEnviando(false);
    }
  }

  const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";

  if (resultado) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold text-stone-900">Solicitud radicada</h2>
        <p className="mt-1 text-sm text-stone-600">
          Su número de radicado es <span className="font-mono text-base font-semibold text-cdmb-700">{resultado.radicado}</span>.
          {resultado.codigoSeguimiento
            ? " Guárdelo junto con el código de seguimiento."
            : " Guárdelo: lo necesitará junto con su identificación para consultar el estado."}
        </p>
        {resultado.codigoSeguimiento && (
          <p className="mt-2 text-sm text-stone-600">
            Código de seguimiento:{" "}
            <span className="font-mono text-base font-semibold text-cdmb-700">{resultado.codigoSeguimiento}</span>
            <span className="mt-0.5 block text-xs text-red-600">
              Es lo único con lo que puede consultar el estado de una solicitud anónima. La CDMB no lo
              conserva y no puede recuperarlo.
            </span>
          </p>
        )}
        {resultado.fechaVencimiento && (
          <p className="mt-1 text-xs text-stone-500">
            Fecha estimada de respuesta: {formatearFechaLarga(resultado.fechaVencimiento)}
            {" "}— es una fecha límite calculada en días hábiles, no una fecha exacta garantizada.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 print:hidden">
          <BotonImprimir>Imprimir constancia</BotonImprimir>
          <Link href="/pqrsd/consultar" className="rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Consultar estado más adelante
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        <input
          type="checkbox"
          checked={anonima}
          onChange={(e) => setAnonima(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-none rounded border-stone-200"
        />
        <span className="text-sm">
          <span className="font-medium text-stone-900">Radicar de forma anónima</span>
          <span className="mt-0.5 block text-xs text-stone-500">
            No se piden sus datos. Recomendado para denuncias. La CDMB tramita la solicitud si aporta pruebas
            o datos concretos (art. 38 Ley 190 de 1995; arts. 67–70 Ley 1474 de 2011). Recibirá un{" "}
            <strong>código de seguimiento</strong> — sin él no podrá consultar el estado ni habrá notificación
            individual del resultado.
          </span>
        </span>
      </label>

      <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        <EncabezadoPaso numero={1} icono={<ListChecks className="h-4 w-4" aria-hidden />} titulo="Tipo de solicitud" />
        <SectionHelp>
          Elija la que mejor describa lo que quiere: una petición pide algo, una queja se refiere a la conducta de un
          servidor, un reclamo exige corregir algo mal hecho, una sugerencia propone una mejora y una denuncia
          reporta un posible hecho irregular. Si tiene dudas, elija &quot;Petición&quot;.
        </SectionHelp>
        <select value={tipoPqrsd} onChange={(e) => setTipoPqrsd(e.target.value)} className={inputCls}>
          <option value="">— Seleccione —</option>
          {TIPOS_PQRSD.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
        </select>
        {ayudaTipo && <p className="mt-1.5 text-xs text-stone-500">{ayudaTipo}</p>}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        <EncabezadoPaso numero={2} icono={<UserRound className="h-4 w-4" aria-hidden />} titulo="Sus datos" />
        {!anonima && (
          <SectionHelp>
            Necesitamos su identificación, ciudad y un medio de contacto para poder responderle y para que después
            pueda consultar el estado de su solicitud con su radicado.
          </SectionHelp>
        )}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
          <label>
            Sitio web
            <input tabIndex={-1} autoComplete="off" value={sitioWeb} onChange={(e) => setSitioWeb(e.target.value)} />
          </label>
        </div>
        {anonima ? (
          <p className="text-sm text-stone-500">
            Radicación anónima: no se registran sus datos. Al enviar recibirá un radicado y un{" "}
            <strong>código de seguimiento</strong> para consultar el estado. La respuesta se produce igual, pero
            sin notificación individual.
          </p>
        ) : (
        <div className="space-y-2">
          <CamposPersona valor={persona} onChange={setPersona} requeridos={{ identificacion: true, nombre: true, ubicacion: true }} />
          <p className="text-xs text-stone-400">Indique correo, celular o teléfono: es el medio por el que la CDMB le responderá.</p>
        </div>
        )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        <EncabezadoPaso numero={3} icono={<MessageSquareText className="h-4 w-4" aria-hidden />} titulo="Su solicitud" />
        <div className="space-y-3">
          <Field label="Asunto" required help="Resumen de una línea de lo que necesita.">
            <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Descripción" required help="Cuente con el mayor detalle posible qué pasó y qué espera que haga la CDMB.">
            <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={6} className={inputCls} placeholder="Describa su petición, queja, reclamo, sugerencia o denuncia…" />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        <EncabezadoPaso numero={4} icono={<Paperclip className="h-4 w-4" aria-hidden />} titulo="Documentos de soporte" descripcion="Opcional." />
        <p className="mb-2 text-xs text-stone-500">
          Si tiene fotos, oficios o cualquier evidencia relacionada, puede adjuntarla aquí. Hasta {MAX_ARCHIVOS_LOTE} archivos,
          cada uno de máximo {TAMANO_MAXIMO_SGDEA_MB} MB.
        </p>
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-stone-200 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50">
          <Upload className="h-4 w-4" aria-hidden />
          Agregar archivos
          <input type="file" multiple accept={ACCEPT_DOCUMENTOS} className="hidden" onChange={(e) => agregarArchivos(e.target.files)} />
        </label>
        {archivos.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {archivos.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-1.5 text-sm">
                <span className="truncate text-stone-700" title={f.name}>{f.name}</span>
                <button type="button" onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))} className="flex-none text-stone-400 hover:text-red-600">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {progreso && <BarraProgresoEnvio pct={progreso.pct} texto={progreso.texto} />}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={enviar}
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-md bg-acento-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60"
        >
          {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {enviando ? "Enviando…" : "Enviar solicitud"}
        </button>
        <span className="text-xs text-stone-400">Recibirá un número de radicado al enviarla.</span>
      </div>
    </div>
  );
}
