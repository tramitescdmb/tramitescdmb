"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Upload, X, CheckCircle2 } from "lucide-react";
import { subirArchivoPublico } from "@/lib/uploads-client";
import { ACCEPT_DOCUMENTOS, extensionPermitida, mensajeTipoNoPermitido } from "@/lib/uploads-config";
import { BotonImprimir } from "@/components/BotonImprimir";

const TIPOS_PQRSD = [
  { value: "PETICION_GENERAL", label: "Petición" },
  { value: "PETICION_DOCUMENTOS", label: "Petición de copia de documentos o información" },
  { value: "CONSULTA", label: "Consulta" },
  { value: "QUEJA", label: "Queja" },
  { value: "RECLAMO", label: "Reclamo" },
  { value: "SUGERENCIA", label: "Sugerencia" },
  { value: "DENUNCIA", label: "Denuncia" },
];
const TIPOS_ID = ["CC", "CE", "NIT", "PA", "TI"];

async function sha256Hex(file: File): Promise<string | null> {
  try {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

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
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ radicado: string; fechaVencimiento: string | null } | null>(null);

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
    try {
      const folder = crypto.randomUUID();
      const documentos: { path: string; nombre: string; mimeType: string; tamanoBytes: number; hashSha256: string | null }[] = [];
      for (const file of archivos) {
        const subido = await subirArchivoPublico(folder, file);
        const hashSha256 = await sha256Hex(file);
        documentos.push({ path: subido.path, nombre: subido.nombre, mimeType: subido.mimeType, tamanoBytes: subido.tamanoBytes, hashSha256 });
      }

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
      setResultado({ radicado: data.radicado, fechaVencimiento: data.fechaVencimiento ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo radicar la solicitud.");
    } finally {
      setEnviando(false);
    }
  }

  const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";
  const labelCls = "mb-1 block text-xs font-medium text-stone-600";

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
        <select value={tipoPqrsd} onChange={(e) => setTipoPqrsd(e.target.value)} className={inputCls}>
          <option value="">— Seleccione —</option>
          {TIPOS_PQRSD.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Sus datos</h2>
        {/* Honeypot: invisible para una persona, pero presente en el DOM para un bot que llena todos los campos. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
          <label>
            Sitio web
            <input tabIndex={-1} autoComplete="off" value={sitioWeb} onChange={(e) => setSitioWeb(e.target.value)} />
          </label>
        </div>
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
              {TIPOS_ID.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Identificación *</span>
            <input value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} className={inputCls} />
          </label>
          <label className="sm:col-span-2">
            <span className={labelCls}>{tipo === "JURIDICA" ? "Razón social" : "Nombre completo"} *</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Municipio *</span>
            <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} className={inputCls}>
              <option value="">— Seleccione —</option>
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
          <label className="sm:col-span-2 lg:col-span-3">
            <span className={labelCls}>Dirección</span>
            <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputCls} />
          </label>
        </div>
        <p className="mt-2 text-xs text-stone-400">Indique correo o teléfono: es el medio por el que la CDMB le responderá.</p>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Su solicitud</h2>
        <div className="space-y-3">
          <label>
            <span className={labelCls}>Asunto *</span>
            <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Descripción *</span>
            <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={6} className={inputCls} placeholder="Describa con el mayor detalle posible su petición, queja, reclamo, sugerencia o denuncia…" />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Documentos de soporte (opcional)</h2>
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
