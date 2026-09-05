"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Upload, X, CheckCircle2 } from "lucide-react";
import { subirArchivoPublico, subirDocumentosConProgreso } from "@/lib/uploads-client";
import { ACCEPT_DOCUMENTOS, extensionPermitida, mensajeTipoNoPermitido } from "@/lib/uploads-config";
import { Field, SectionHelp } from "@/components/Field";
import { BarraProgresoEnvio } from "@/components/BarraProgresoEnvio";
import { BotonImprimir } from "@/components/BotonImprimir";

const TIPOS_PQRSD = [
  { value: "PETICION_GENERAL", label: "Petición", ayuda: "Pide que la CDMB haga algo o le entregue información. Responde en 15 días hábiles." },
  { value: "PETICION_DOCUMENTOS", label: "Petición de copia de documentos", ayuda: "Pide copia de un documento específico que tenga la CDMB. Responde en 10 días hábiles." },
  { value: "CONSULTA", label: "Consulta", ayuda: "Pregunta sobre un tema de competencia de la CDMB, sin pedir un trámite puntual. Responde en 30 días hábiles." },
  { value: "QUEJA", label: "Queja", ayuda: "Manifiesta inconformidad con la conducta de un servidor de la CDMB. Responde en 15 días hábiles." },
  { value: "RECLAMO", label: "Reclamo", ayuda: "Exige que se corrija o se cumpla algo que no se hizo bien. Responde en 15 días hábiles." },
  { value: "SUGERENCIA", label: "Sugerencia", ayuda: "Propone una idea o mejora para la entidad. Responde en 15 días hábiles." },
  { value: "DENUNCIA", label: "Denuncia", ayuda: "Pone en conocimiento un posible hecho irregular. Responde en 15 días hábiles." },
];
const TIPOS_ID = ["CC", "CE", "NIT", "PA", "TI"];

export function PqrsdPublicoForm({ municipios }: { municipios: string[] }) {
  const [tsCarga] = useState(() => Date.now());
  const [tipoPqrsd, setTipoPqrsd] = useState("");
  const [tipo, setTipo] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [tipoId, setTipoId] = useState("CC");
  const [identificacion, setIdentificacion] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [asunto, setAsunto] = useState("");
  const [contenido, setContenido] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [sitioWeb, setSitioWeb] = useState(""); // honeypot — un ciudadano real nunca llena esto
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<{ pct: number; texto: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ radicado: string; fechaVencimiento: string | null } | null>(null);

  const ayudaTipo = TIPOS_PQRSD.find((t) => t.value === tipoPqrsd)?.ayuda;

  function agregarArchivos(lista: FileList | null) {
    if (!lista) return;
    const nuevos: File[] = [];
    for (const f of Array.from(lista)) {
      if (!extensionPermitida(f.name)) {
        setError(mensajeTipoNoPermitido(f.name));
        continue;
      }
      nuevos.push(f);
    }
    setArchivos((prev) => [...prev, ...nuevos]);
  }

  async function enviar() {
    setError(null);
    if (!tipoPqrsd) return setError("Seleccione el tipo de solicitud.");
    if (!asunto.trim()) return setError("El asunto es obligatorio.");
    if (!contenido.trim()) return setError("Describa su solicitud.");
    if (!nombre.trim()) return setError("El nombre o razón social es obligatorio.");
    if (!identificacion.trim()) return setError("La identificación es obligatoria.");
    if (!municipio) return setError("Seleccione su municipio.");
    if (!email.trim() && !telefono.trim()) return setError("Indique al menos un medio de contacto (correo o teléfono).");

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
          terceroTipo: tipo,
          terceroTipoIdentificacion: tipoId,
          terceroIdentificacion: identificacion.trim(),
          terceroNombre: nombre.trim(),
          terceroEmail: email.trim() || null,
          terceroTelefono: telefono.trim() || null,
          terceroMunicipio: municipio,
          documentos,
          tsCarga,
          sitioWeb,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudo radicar la solicitud.");
      setProgreso({ pct: 100, texto: "Listo." });
      setResultado({ radicado: data.radicado, fechaVencimiento: data.fechaVencimiento ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo radicar la solicitud.");
      setProgreso(null);
    } finally {
      setEnviando(false);
    }
  }

  const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

  if (resultado) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold text-stone-900">Solicitud radicada</h2>
        <p className="mt-1 text-sm text-stone-600">
          Su número de radicado es <span className="font-mono text-base font-semibold text-cdmb-700">{resultado.radicado}</span>.
          Guárdelo: lo necesitará junto con su identificación para consultar el estado.
        </p>
        {resultado.fechaVencimiento && (
          <p className="mt-1 text-xs text-stone-500">
            Fecha estimada de respuesta: {new Date(resultado.fechaVencimiento).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}
            {" "}— es una fecha límite calculada en días hábiles, no una fecha exacta garantizada.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 print:hidden">
          <BotonImprimir>Imprimir constancia</BotonImprimir>
          <Link href="/pqrsd/consultar" className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Consultar estado más adelante
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Tipo de solicitud</h2>
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

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Sus datos</h2>
        <SectionHelp>
          Necesitamos su identificación, municipio y un medio de contacto para poder responderle y para que después
          pueda consultar el estado de su solicitud con su radicado.
        </SectionHelp>
        {/* Honeypot: invisible para una persona, pero presente en el DOM para un bot que llena todos los campos. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
          <label>
            Sitio web
            <input tabIndex={-1} autoComplete="off" value={sitioWeb} onChange={(e) => setSitioWeb(e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Tipo de persona" help="Natural: usted como persona. Jurídica: una empresa o entidad.">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as "NATURAL" | "JURIDICA")} className={inputCls}>
              <option value="NATURAL">Natural</option>
              <option value="JURIDICA">Jurídica</option>
            </select>
          </Field>
          <Field label="Tipo de identificación">
            <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={inputCls}>
              {TIPOS_ID.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </Field>
          <Field label="Identificación" required help="Número de documento o NIT.">
            <input value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={tipo === "JURIDICA" ? "Razón social" : "Nombre completo"} required>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Municipio" required>
            <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} className={inputCls}>
              <option value="">— Seleccione —</option>
              {municipios.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </Field>
          <Field label="Correo electrónico" help="Por aquí le avisamos la respuesta, si lo indica.">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} type="email" />
          </Field>
          <Field label="Teléfono">
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputCls} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Dirección">
              <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-400">Indique correo o teléfono: es el medio por el que la CDMB le responderá.</p>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Su solicitud</h2>
        <div className="space-y-3">
          <Field label="Asunto" required help="Resumen de una línea de lo que necesita.">
            <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Descripción" required help="Cuente con el mayor detalle posible qué pasó y qué espera que haga la CDMB.">
            <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={6} className={inputCls} placeholder="Describa su petición, queja, reclamo, sugerencia o denuncia…" />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Documentos de soporte (opcional)</h2>
        <p className="mb-2 text-xs text-stone-500">Si tiene fotos, oficios o cualquier evidencia relacionada, puede adjuntarla aquí.</p>
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50">
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
          className="inline-flex items-center gap-2 rounded-md bg-cdmb-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-60"
        >
          {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {enviando ? "Enviando…" : "Enviar solicitud"}
        </button>
        <span className="text-xs text-stone-400">Recibirá un número de radicado al enviarla.</span>
      </div>
    </div>
  );
}
