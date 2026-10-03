"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X, UserRound, Mail, FolderTree, Paperclip } from "lucide-react";
import { EncabezadoPaso } from "@/components/sgdea/EncabezadoPaso";
import type { SerieBuscable } from "@/components/BuscadorSubserieTRD";
import { subirArchivoDirecto, subirDocumentosConProgreso } from "@/lib/uploads-client";
import { ACCEPT_DOCUMENTOS } from "@/lib/uploads-config";
import { filtrarLoteSGDEA, MAX_ARCHIVOS_LOTE, TAMANO_MAXIMO_SGDEA_MB } from "@/lib/uploads-sgdea";
import { Field, SectionHelp } from "@/components/Field";
import { BarraProgresoEnvio } from "@/components/BarraProgresoEnvio";
import { BuscadorSubserieTRD } from "@/components/BuscadorSubserieTRD";
import { MunicipioSelectorTercero } from "@/components/MunicipioSelectorTercero";

type Dependencia = { id: string; nombre: string };
type Serie = SerieBuscable;

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
  const [departamento, setDepartamento] = useState("");
  const [terceroCargado, setTerceroCargado] = useState(false);
  const [medio, setMedio] = useState("FISICO");
  const [asunto, setAsunto] = useState("");
  const [contenido, setContenido] = useState("");
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

  function cambiarDependencia(nuevoId: string) {
    setDependenciaId(nuevoId);
  }

  async function buscarTercero() {
    const id = identificacion.trim();
    if (id.length < 4 || nombre.trim() || terceroCargado) return;
    try {
      const r = await fetch(`/api/correspondencia/tercero?identificacion=${encodeURIComponent(id)}`);
      if (!r.ok) return;
      const { tercero } = await r.json();
      if (!tercero) return;
      setTipo(tercero.tipo === "JURIDICA" ? "JURIDICA" : "NATURAL");
      setNombre(tercero.nombre ?? "");
      if (tercero.email) setEmail(tercero.email);
      if (tercero.telefono) setTelefono(tercero.telefono);
      if (tercero.direccion) setDireccion(tercero.direccion);
      if (tercero.municipio) setMunicipio(tercero.municipio);
      if (tercero.departamento) setDepartamento(tercero.departamento);
      setTerceroCargado(true);
    } catch {}
  }

  function agregarArchivos(lista: FileList | null) {
    if (!lista) return;
    const { validos, error: err } = filtrarLoteSGDEA(Array.from(lista), archivos.length);
    if (err) setError(err);
    if (validos.length) setArchivos((prev) => [...prev, ...validos]);
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
          contenido: contenido.trim() || null,
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
          terceroMunicipio: municipio.trim() || null,
          terceroDepartamento: departamento.trim() || null,
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

  const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        <EncabezadoPaso
          numero={1}
          icono={<UserRound className="h-4 w-4" aria-hidden />}
          titulo="Remitente"
          descripcion="Quién envía la comunicación. Escriba primero la identificación: si ya radicó antes, se cargan sus datos."
        />
        <SectionHelp>
          Si queda identificado (documento) y con municipio, se guarda en el registro maestro de terceros para no
          volver a digitarlo en el próximo radicado.
        </SectionHelp>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Tipo de persona">
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
          <Field label="Identificación" help="En blanco si el remitente es anónimo. Al salir del campo se cargan los datos si ya radicó antes.">
            <input
              value={identificacion}
              onChange={(e) => { setIdentificacion(e.target.value); setTerceroCargado(false); }}
              onBlur={buscarTercero}
              className={inputCls}
              placeholder="Cédula o NIT"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label={tipo === "JURIDICA" ? "Razón social" : "Nombre completo"}
              required
              help={terceroCargado ? "Datos cargados de un radicado anterior — puede corregirlos." : "Tal como debe quedar en la constancia y en la bitácora."}
            >
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Municipio">
            <MunicipioSelectorTercero
              municipios={municipios}
              municipio={municipio}
              departamento={departamento}
              onMunicipio={setMunicipio}
              onDepartamento={setDepartamento}
              inputCls={inputCls}
            />
          </Field>
          <Field label="Correo electrónico">
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

      <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        <EncabezadoPaso
          numero={2}
          icono={<Mail className="h-4 w-4" aria-hidden />}
          titulo="Comunicación"
          descripcion="Asunto, qué se solicita, medio de recepción y si es una PQRSD con término de ley."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Asunto" required>
              <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Descripción de la solicitud" help="Qué pide el remitente, además de lo que digan los documentos adjuntos.">
              <textarea
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                rows={4}
                className={inputCls}
                placeholder="Resumen de la solicitud…"
              />
            </Field>
          </div>
          <Field label="Medio de recepción">
            <select value={medio} onChange={(e) => setMedio(e.target.value)} className={inputCls}>
              {MEDIOS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
          </Field>
          <Field label="N.º de folios">
            <input type="number" min={1} value={folios} onChange={(e) => setFolios(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Anexos (descripción)" help="Aparte del documento principal.">
              <input value={anexos} onChange={(e) => setAnexos(e.target.value)} className={inputCls} placeholder="Ej. 1 CD, 2 planos" />
            </Field>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Field
              label="Tipo PQRSD"
              help="Solo si es petición, queja, reclamo, sugerencia o denuncia — calcula la fecha límite de ley (Ley 1755/2015). Independiente de la serie documental de abajo."
            >
              <select value={tipoPqrsd} onChange={(e) => setTipoPqrsd(e.target.value)} className={inputCls}>
                {TIPOS_PQRSD.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        <div>
          <EncabezadoPaso
            numero={3}
            icono={<FolderTree className="h-4 w-4" aria-hidden />}
            titulo="Destino y clasificación (TRD)"
            descripcion="A qué dependencia va y en qué serie y subserie se archiva."
          />
          <SectionHelp>
            La dependencia destino es a quién va dirigida (se puede repartir después). La clasificación TRD es
            opcional al radicar y se corrige luego desde el detalle — la serie y la subserie que puede elegir ya
            están filtradas por esa dependencia destino.
          </SectionHelp>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Dependencia destino" help="Puede repartirla después si no se sabe todavía.">
              <select value={dependenciaId} onChange={(e) => cambiarDependencia(e.target.value)} className={inputCls}>
                <option value="">— Sin asignar —</option>
                {dependencias.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Clasificación TRD (serie / subserie)">
                <BuscadorSubserieTRD
                  series={series}
                  serieId={serieId}
                  subserieId={subserieId}
                  dependenciaId={dependenciaId || null}
                  dependenciaControlada
                  onChange={(s, ss) => { setSerieId(s); setSubserieId(ss); }}
                />
              </Field>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        <EncabezadoPaso
          numero={4}
          icono={<Paperclip className="h-4 w-4" aria-hidden />}
          titulo="Documentos adjuntos"
          descripcion={`El documento recibido y sus anexos digitalizados. Hasta ${MAX_ARCHIVOS_LOTE} archivos, cada uno de máximo ${TAMANO_MAXIMO_SGDEA_MB} MB.`}
        />
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
        <p className="mt-2 text-xs text-stone-400">Se calcula el hash SHA-256 de cada archivo al subirlo: sirve para comprobar más adelante que nadie lo alteró.</p>
      </section>

      {progreso && <BarraProgresoEnvio pct={progreso.pct} texto={progreso.texto} />}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={radicar}
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-md bg-acento-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60"
        >
          {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {enviando ? "Radicando…" : "Radicar comunicación"}
        </button>
        <span className="text-xs text-stone-400">Se asigna un número de radicado consecutivo e inalterable.</span>
      </div>
    </div>
  );
}
