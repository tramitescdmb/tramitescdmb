"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X } from "lucide-react";
import { subirArchivoDirecto, subirDocumentosConProgreso } from "@/lib/uploads-client";
import { ACCEPT_DOCUMENTOS, extensionPermitida, mensajeTipoNoPermitido } from "@/lib/uploads-config";
import { Field, SectionHelp } from "@/components/Field";
import { BarraProgresoEnvio } from "@/components/BarraProgresoEnvio";

type Dependencia = { id: string; nombre: string };
type Subserie = { id: string; codigo: string; nombre: string };
type Serie = { id: string; codigo: string; nombre: string; subseries: Subserie[] };

const TIPOS_ID = ["CC", "CE", "NIT", "PA", "TI", "ANONIMO", "OTRO"];
const TIPOS_PQRSD = [
  { value: "", label: "— No es PQRSD —" },
  { value: "PETICION_GENERAL", label: "Petición (15 días hábiles)" },
  { value: "PETICION_DOCUMENTOS", label: "Petición de documentos/información (10 días hábiles)" },
  { value: "CONSULTA", label: "Consulta (30 días hábiles)" },
  { value: "QUEJA", label: "Queja (15 días hábiles)" },
  { value: "RECLAMO", label: "Reclamo (15 días hábiles)" },
  { value: "SUGERENCIA", label: "Sugerencia (15 días hábiles)" },
  { value: "DENUNCIA", label: "Denuncia (15 días hábiles)" },
];
const MEDIOS = [
  { value: "FISICO", label: "Físico" },
  { value: "CORREO_ELECTRONICO", label: "Correo electrónico" },
  { value: "WEB", label: "Web" },
  { value: "FAX", label: "Fax" },
  { value: "PRESENCIAL", label: "Presencial" },
  { value: "TELEFONICO", label: "Telefónico" },
  { value: "OTRO", label: "Otro" },
];

export function VentanillaRadicacionForm({
  dependencias,
  series,
  municipios,
}: {
  dependencias: Dependencia[];
  series: Serie[];
  municipios: string[];
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const [tipoId, setTipoId] = useState("CC");
  const [identificacion, setIdentificacion] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [medio, setMedio] = useState("FISICO");
  const [asunto, setAsunto] = useState("");
  const [folios, setFolios] = useState(1);
  const [anexos, setAnexos] = useState("");
  const [dependenciaId, setDependenciaId] = useState("");
  const [tipoPqrsd, setTipoPqrsd] = useState("");
  const [serieId, setSerieId] = useState("");
  const [subserieId, setSubserieId] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<{ pct: number; texto: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subseries = useMemo(() => series.find((s) => s.id === serieId)?.subseries ?? [], [series, serieId]);

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

  async function radicar() {
    setError(null);
    if (!asunto.trim()) return setError("El asunto es obligatorio.");
    if (!nombre.trim()) return setError("El nombre o razón social del remitente es obligatorio.");
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

      const resp = await fetch("/api/correspondencia/radicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asunto: asunto.trim(),
          folios,
          anexosDescripcion: anexos.trim() || null,
          medio,
          terceroTipo: tipo,
          terceroTipoIdentificacion: tipoId,
          terceroIdentificacion: identificacion.trim() || null,
          terceroNombre: nombre.trim(),
          terceroEmail: email.trim() || null,
          terceroTelefono: telefono.trim() || null,
          terceroDireccion: direccion.trim() || null,
          terceroMunicipio: municipio || null,
          dependenciaDestinoId: dependenciaId || null,
          tipoPqrsd: tipoPqrsd || null,
          serieId: serieId || null,
          subserieId: subserieId || null,
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
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Remitente</h2>
        <SectionHelp>
          Datos de quién envía la comunicación. Si queda identificado (documento) y con municipio, se guarda en el
          registro maestro de terceros — la próxima vez que radique algo suyo no hay que volver a digitarlos.
        </SectionHelp>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Tipo de persona" help="Natural: una persona. Jurídica: una empresa o entidad.">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as "NATURAL" | "JURIDICA")} className={inputCls}>
              <option value="NATURAL">Natural</option>
              <option value="JURIDICA">Jurídica</option>
            </select>
          </Field>
          <Field label="Tipo de identificación" help="Tipo de documento del remitente.">
            <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={inputCls}>
              {TIPOS_ID.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </Field>
          <Field label="Identificación" help="Cédula o NIT. Puede dejarla en blanco si el remitente es anónimo.">
            <input value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} className={inputCls} placeholder="Cédula o NIT" />
          </Field>
          <div className="sm:col-span-2">
            <Field label={tipo === "JURIDICA" ? "Razón social" : "Nombre completo"} required help="Tal como debe quedar en la constancia y en la bitácora.">
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Municipio" help="Municipio de residencia o domicilio del remitente.">
            <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} className={inputCls}>
              <option value="">— Sin especificar —</option>
              {municipios.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </Field>
          <Field label="Correo electrónico" help="Para poder contactar al remitente si hace falta.">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} type="email" />
          </Field>
          <Field label="Teléfono">
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Dirección">
              <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Comunicación</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Asunto" required help="Resumen de una línea de lo que trata la comunicación.">
              <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Medio de recepción" help="Cómo llegó físicamente esta comunicación a la CDMB.">
            <select value={medio} onChange={(e) => setMedio(e.target.value)} className={inputCls}>
              {MEDIOS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
          </Field>
          <Field label="N.º de folios" help="Cantidad de hojas del documento recibido.">
            <input type="number" min={1} value={folios} onChange={(e) => setFolios(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Anexos (descripción)" help="Qué trae adjunto además del documento principal.">
              <input value={anexos} onChange={(e) => setAnexos(e.target.value)} className={inputCls} placeholder="Ej. 1 CD, 2 planos" />
            </Field>
          </div>
          <Field label="Dependencia destino" help="A qué área de la CDMB le corresponde atenderla. Puede dejarla sin asignar y distribuirla después.">
            <select value={dependenciaId} onChange={(e) => setDependenciaId(e.target.value)} className={inputCls}>
              <option value="">— Sin asignar —</option>
              {dependencias.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
            </select>
          </Field>
          <Field
            label="Tipo PQRSD"
            help="Selecciónelo SOLO si es una petición, queja, reclamo, sugerencia o denuncia de un ciudadano — el sistema calcula automáticamente la fecha límite de respuesta (Ley 1755 de 2015)."
          >
            <select value={tipoPqrsd} onChange={(e) => setTipoPqrsd(e.target.value)} className={inputCls}>
              {TIPOS_PQRSD.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
          </Field>
          <Field label="Serie documental (TRD)" help="Clasificación archivística. Si no sabe cuál usar, déjela 'Sin clasificar' — se puede corregir después.">
            <select value={serieId} onChange={(e) => { setSerieId(e.target.value); setSubserieId(""); }} className={inputCls}>
              <option value="">— Sin clasificar —</option>
              {series.map((s) => (<option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>))}
            </select>
          </Field>
          <Field label="Subserie">
            <select value={subserieId} onChange={(e) => setSubserieId(e.target.value)} className={inputCls} disabled={!subseries.length}>
              <option value="">{subseries.length ? "— Seleccione —" : "—"}</option>
              {subseries.map((ss) => (<option key={ss.id} value={ss.id}>{ss.codigo} — {ss.nombre}</option>))}
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Documentos adjuntos</h2>
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
        <p className="mt-2 text-xs text-stone-400">Se calcula el hash SHA-256 de cada archivo al subirlo: sirve para comprobar más adelante que nadie lo alteró.</p>
      </section>

      {progreso && <BarraProgresoEnvio pct={progreso.pct} texto={progreso.texto} />}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={radicar}
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-md bg-cdmb-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-60"
        >
          {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {enviando ? "Radicando…" : "Radicar comunicación"}
        </button>
        <span className="text-xs text-stone-400">Se asigna un número de radicado consecutivo e inalterable.</span>
      </div>
    </div>
  );
}
