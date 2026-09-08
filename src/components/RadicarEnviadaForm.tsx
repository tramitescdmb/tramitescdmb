"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X, ShieldCheck } from "lucide-react";
import { subirArchivoDirecto, subirDocumentosConProgreso } from "@/lib/uploads-client";
import { ACCEPT_DOCUMENTOS, extensionPermitida, mensajeTipoNoPermitido } from "@/lib/uploads-config";
import { Field, SectionHelp } from "@/components/Field";
import { BarraProgresoEnvio } from "@/components/BarraProgresoEnvio";
import { BuscadorRecibidaPendiente } from "@/components/BuscadorRecibidaPendiente";

type Dependencia = { id: string; nombre: string };
type Subserie = { id: string; codigo: string; nombre: string };
type Serie = { id: string; codigo: string; nombre: string; dependenciaId: string | null; subseries: Subserie[] };
type ValoresIniciales = {
  respondeAId?: string;
  respondeALabel?: string;
  asunto?: string;
  contenido?: string;
  destinatarioTipo?: "NATURAL" | "JURIDICA";
  destinatarioTipoIdentificacion?: string;
  destinatarioIdentificacion?: string;
  destinatarioNombre?: string;
  destinatarioEmail?: string;
  destinatarioTelefono?: string;
  destinatarioDireccion?: string;
  destinatarioMunicipio?: string;
};

const MEDIOS = [
  { value: "FISICO", label: "Físico" },
  { value: "CORREO_ELECTRONICO", label: "Correo electrónico" },
  { value: "WEB", label: "Web" },
  { value: "FAX", label: "Fax" },
  { value: "OTRO", label: "Otro" },
];

export function RadicarEnviadaForm({
  dependencias,
  series,
  municipios,
  inicial,
  documentosRespuesta,
}: {
  dependencias: Dependencia[];
  series: Serie[];
  municipios: string[];
  inicial?: ValoresIniciales;
  documentosRespuesta?: string[];
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"NATURAL" | "JURIDICA">(inicial?.destinatarioTipo ?? "NATURAL");
  const [tipoId, setTipoId] = useState(inicial?.destinatarioTipoIdentificacion ?? "CC");
  const [identificacion, setIdentificacion] = useState(inicial?.destinatarioIdentificacion ?? "");
  const [nombre, setNombre] = useState(inicial?.destinatarioNombre ?? "");
  const [email, setEmail] = useState(inicial?.destinatarioEmail ?? "");
  const [telefono, setTelefono] = useState(inicial?.destinatarioTelefono ?? "");
  const [direccion, setDireccion] = useState(inicial?.destinatarioDireccion ?? "");
  const [municipio, setMunicipio] = useState(inicial?.destinatarioMunicipio ?? "");
  const [medio, setMedio] = useState("FISICO");
  const [asunto, setAsunto] = useState(inicial?.asunto ?? "");
  const [contenido, setContenido] = useState(inicial?.contenido ?? "");
  const [folios, setFolios] = useState(1);
  const [dependenciaOrigenId, setDependenciaOrigenId] = useState("");
  const [serieId, setSerieId] = useState("");
  const [subserieId, setSubserieId] = useState("");
  const [respondeAId, setRespondeAId] = useState(inicial?.respondeAId ?? "");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<{ pct: number; texto: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const seriesDeDependencia = useMemo(() => {
    const sinDependencia = series.filter((s) => !s.dependenciaId);
    if (!dependenciaOrigenId) return sinDependencia;
    return [...series.filter((s) => s.dependenciaId === dependenciaOrigenId), ...sinDependencia];
  }, [series, dependenciaOrigenId]);
  const subseries = useMemo(() => seriesDeDependencia.find((s) => s.id === serieId)?.subseries ?? [], [seriesDeDependencia, serieId]);

  function cambiarDependenciaOrigen(nuevoId: string) {
    setDependenciaOrigenId(nuevoId);
    setSerieId("");
    setSubserieId("");
  }

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

  async function radicarYFirmar() {
    setError(null);
    if (!asunto.trim()) return setError("El asunto es obligatorio.");
    if (!contenido.trim()) return setError("El contenido del oficio es obligatorio: es lo que queda firmado.");
    if (!nombre.trim()) return setError("El nombre o razón social del destinatario es obligatorio.");
    setEnviando(true);
    setProgreso({ pct: 0, texto: "Preparando…" });
    try {
      const folder = crypto.randomUUID();
      const documentos = await subirDocumentosConProgreso(
        archivos,
        (f, file) => subirArchivoDirecto(f, file, { nuevo: true }),
        folder,
        (pct, texto) => setProgreso({ pct, texto })
      );

      const resp = await fetch("/api/correspondencia/radicar-enviada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asunto: asunto.trim(),
          contenido: contenido.trim(),
          folios,
          medio,
          destinatarioTipo: tipo,
          destinatarioTipoIdentificacion: tipoId,
          destinatarioIdentificacion: identificacion.trim() || null,
          destinatarioNombre: nombre.trim(),
          destinatarioEmail: email.trim() || null,
          destinatarioTelefono: telefono.trim() || null,
          destinatarioDireccion: direccion.trim() || null,
          destinatarioMunicipio: municipio || null,
          dependenciaOrigenId: dependenciaOrigenId || null,
          serieId: serieId || null,
          subserieId: subserieId || null,
          respondeAId: respondeAId || null,
          documentos,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudo radicar.");
      setProgreso({ pct: 100, texto: "Listo." });
      router.push(`/correspondencia/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo radicar la comunicación.");
      setProgreso(null);
      setEnviando(false);
    }
  }

  const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-stone-900">¿Responde a una comunicación recibida?</h2>
        <p className="mb-3 text-xs text-stone-400">Opcional — busque por radicado, asunto o tercero. Si la elige, esa recibida pasa a estado &quot;Respondida&quot; al radicar esta enviada.</p>
        <BuscadorRecibidaPendiente
          valorInicial={inicial?.respondeAId && inicial?.respondeALabel ? { id: inicial.respondeAId, label: inicial.respondeALabel } : null}
          onChange={setRespondeAId}
        />
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Destinatario</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Tipo de persona">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as "NATURAL" | "JURIDICA")} className={inputCls}>
              <option value="NATURAL">Natural</option>
              <option value="JURIDICA">Jurídica</option>
            </select>
          </Field>
          <Field label="Tipo de identificación">
            <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={inputCls}>
              {["CC", "CE", "NIT", "PA", "TI", "OTRO"].map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </Field>
          <Field label="Identificación">
            <input value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={tipo === "JURIDICA" ? "Razón social" : "Nombre completo"} required>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Municipio">
            <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} className={inputCls}>
              <option value="">— Sin especificar —</option>
              {municipios.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </Field>
          <Field label="Correo electrónico">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} type="email" />
          </Field>
          <Field label="Teléfono">
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Dirección" help="Si el medio de envío es físico.">
              <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Oficio</h2>
        <SectionHelp>
          Al radicar queda firmado con hash SHA-256 (Ley 527/1999) — el asunto y el contenido dejan de poder
          modificarse sin que se detecte.
        </SectionHelp>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Asunto" required>
              <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Contenido" required>
              <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={8} className={inputCls} placeholder="Cuerpo del oficio…" />
            </Field>
          </div>
          <Field label="Medio de envío">
            <select value={medio} onChange={(e) => setMedio(e.target.value)} className={inputCls}>
              {MEDIOS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
          </Field>
          <Field label="N.º de folios">
            <input type="number" min={1} value={folios} onChange={(e) => setFolios(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
          </Field>
        </div>

        <div className="mt-4 border-t border-stone-100 pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Clasificación y origen (TRD)</h3>
          <SectionHelp>
            La serie documental depende de la dependencia que emite (cada una tiene su propia TRD). Sin
            especificar, solo queda disponible &quot;Sin clasificar&quot; — se corrige después desde el detalle.
          </SectionHelp>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Dependencia que emite">
              <select value={dependenciaOrigenId} onChange={(e) => cambiarDependenciaOrigen(e.target.value)} className={inputCls}>
                <option value="">— Sin especificar —</option>
                {dependencias.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
              </select>
            </Field>
            <Field label="Serie documental (TRD)">
              <select value={serieId} onChange={(e) => { setSerieId(e.target.value); setSubserieId(""); }} className={inputCls}>
                <option value="">— Sin clasificar —</option>
                {seriesDeDependencia.map((s) => (<option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>))}
              </select>
            </Field>
            <Field label="Subserie">
              <select value={subserieId} onChange={(e) => setSubserieId(e.target.value)} className={inputCls} disabled={!subseries.length}>
                <option value="">{subseries.length ? "— Seleccione —" : "—"}</option>
                {subseries.map((ss) => (<option key={ss.id} value={ss.id}>{ss.codigo} — {ss.nombre}</option>))}
              </select>
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Documentos adjuntos</h2>
        {documentosRespuesta && documentosRespuesta.length > 0 && (
          <SectionHelp>
            Se incluirán automáticamente en el oficio {documentosRespuesta.length === 1 ? "el documento" : "los documentos"} que
            el funcionario adjuntó a su respuesta: {documentosRespuesta.join(", ")}.
          </SectionHelp>
        )}
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
          onClick={radicarYFirmar}
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-md bg-cdmb-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-60"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
          {enviando ? "Radicando y firmando…" : "Radicar y firmar"}
        </button>
        <span className="text-xs text-stone-400">Se asigna consecutivo y se firma electrónicamente en el mismo paso.</span>
      </div>
    </div>
  );
}
