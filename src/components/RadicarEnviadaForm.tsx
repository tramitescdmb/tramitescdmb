"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X, ShieldCheck } from "lucide-react";
import { subirArchivoDirecto } from "@/lib/uploads-client";
import { ACCEPT_DOCUMENTOS, extensionPermitida, mensajeTipoNoPermitido } from "@/lib/uploads-config";

type Dependencia = { id: string; nombre: string };
type Subserie = { id: string; codigo: string; nombre: string };
type Serie = { id: string; codigo: string; nombre: string; subseries: Subserie[] };
type RecibidaPendiente = { id: string; radicado: string; asunto: string; terceroNombre: string | null };

const MEDIOS = [
  { value: "FISICO", label: "Físico" },
  { value: "CORREO_ELECTRONICO", label: "Correo electrónico" },
  { value: "WEB", label: "Web" },
  { value: "FAX", label: "Fax" },
  { value: "OTRO", label: "Otro" },
];

async function sha256Hex(file: File): Promise<string | null> {
  try {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

export function RadicarEnviadaForm({
  dependencias,
  series,
  municipios,
  recibidasPendientes,
}: {
  dependencias: Dependencia[];
  series: Serie[];
  municipios: string[];
  recibidasPendientes: RecibidaPendiente[];
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
  const [contenido, setContenido] = useState("");
  const [folios, setFolios] = useState(1);
  const [dependenciaOrigenId, setDependenciaOrigenId] = useState("");
  const [serieId, setSerieId] = useState("");
  const [subserieId, setSubserieId] = useState("");
  const [respondeAId, setRespondeAId] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
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

  async function radicarYFirmar() {
    setError(null);
    if (!asunto.trim()) return setError("El asunto es obligatorio.");
    if (!contenido.trim()) return setError("El contenido del oficio es obligatorio: es lo que queda firmado.");
    if (!nombre.trim()) return setError("El nombre o razón social del destinatario es obligatorio.");
    setEnviando(true);
    try {
      const folder = crypto.randomUUID();
      const documentos: { path: string; nombre: string; mimeType: string; tamanoBytes: number; hashSha256: string | null }[] = [];
      for (const file of archivos) {
        const subido = await subirArchivoDirecto(folder, file, { nuevo: true });
        const hashSha256 = await sha256Hex(file);
        documentos.push({ path: subido.path, nombre: subido.nombre, mimeType: subido.mimeType, tamanoBytes: subido.tamanoBytes, hashSha256 });
      }

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
      router.push(`/correspondencia/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo radicar la comunicación.");
      setEnviando(false);
    }
  }

  const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";
  const labelCls = "mb-1 block text-xs font-medium text-stone-600";

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {recibidasPendientes.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-stone-900">¿Responde a una comunicación recibida?</h2>
          <p className="mb-3 text-xs text-stone-400">Opcional — si la elige, esa recibida pasa a estado &quot;Respondida&quot; al radicar esta enviada.</p>
          <select value={respondeAId} onChange={(e) => setRespondeAId(e.target.value)} className={inputCls}>
            <option value="">— No responde a ninguna —</option>
            {recibidasPendientes.map((r) => (
              <option key={r.id} value={r.id}>{r.radicado} — {r.asunto.slice(0, 60)}{r.terceroNombre ? ` (${r.terceroNombre})` : ""}</option>
            ))}
          </select>
        </section>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Destinatario</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label>
            <span className={labelCls}>Tipo de persona</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as "NATURAL" | "JURIDICA")} className={inputCls}>
              <option value="NATURAL">Natural</option>
              <option value="JURIDICA">Jurídica</option>
            </select>
          </label>
          <label>
            <span className={labelCls}>Tipo de identificación</span>
            <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={inputCls}>
              {["CC", "CE", "NIT", "PA", "TI", "OTRO"].map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Identificación</span>
            <input value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} className={inputCls} />
          </label>
          <label className="sm:col-span-2">
            <span className={labelCls}>{tipo === "JURIDICA" ? "Razón social" : "Nombre completo"} *</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Municipio</span>
            <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} className={inputCls}>
              <option value="">— Sin especificar —</option>
              {municipios.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Correo electrónico</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} type="email" />
          </label>
          <label>
            <span className={labelCls}>Teléfono</span>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputCls} />
          </label>
          <label className="sm:col-span-2">
            <span className={labelCls}>Dirección</span>
            <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputCls} />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Oficio</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="sm:col-span-2 lg:col-span-4">
            <span className={labelCls}>Asunto *</span>
            <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={inputCls} />
          </label>
          <label className="sm:col-span-2 lg:col-span-4">
            <span className={labelCls}>Contenido *</span>
            <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={8} className={inputCls} placeholder="Cuerpo del oficio…" />
            <p className="mt-1 text-[11px] text-stone-400">Este texto, junto con el asunto y el radicado, es lo que queda firmado con hash SHA-256.</p>
          </label>
          <label>
            <span className={labelCls}>Medio de envío</span>
            <select value={medio} onChange={(e) => setMedio(e.target.value)} className={inputCls}>
              {MEDIOS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
          </label>
          <label>
            <span className={labelCls}>N.º de folios</span>
            <input type="number" min={1} value={folios} onChange={(e) => setFolios(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Dependencia que emite</span>
            <select value={dependenciaOrigenId} onChange={(e) => setDependenciaOrigenId(e.target.value)} className={inputCls}>
              <option value="">— Sin especificar —</option>
              {dependencias.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Serie documental (TRD)</span>
            <select value={serieId} onChange={(e) => { setSerieId(e.target.value); setSubserieId(""); }} className={inputCls}>
              <option value="">— Sin clasificar —</option>
              {series.map((s) => (<option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Subserie</span>
            <select value={subserieId} onChange={(e) => setSubserieId(e.target.value)} className={inputCls} disabled={!subseries.length}>
              <option value="">{subseries.length ? "— Seleccione —" : "—"}</option>
              {subseries.map((ss) => (<option key={ss.id} value={ss.id}>{ss.codigo} — {ss.nombre}</option>))}
            </select>
          </label>
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
      </section>

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
