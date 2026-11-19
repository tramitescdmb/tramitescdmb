"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X, ShieldCheck, ArrowRightLeft, FileText, FolderTree, Paperclip, Users } from "lucide-react";
import { EncabezadoPaso } from "@/components/sgdea/EncabezadoPaso";
import { subirArchivoMemorando, subirDocumentosConProgreso } from "@/lib/uploads-client";
import { ACCEPT_DOCUMENTOS } from "@/lib/uploads-config";
import { filtrarLoteSGDEA, MAX_ARCHIVOS_LOTE, TAMANO_MAXIMO_SGDEA_MB } from "@/lib/uploads-sgdea";
import { Field, SectionHelp } from "@/components/Field";
import { BarraProgresoEnvio } from "@/components/BarraProgresoEnvio";
import { BuscadorSubserieTRD } from "@/components/BuscadorSubserieTRD";
import { PlantillaSelector, type PlantillaOpcion } from "@/components/PlantillaSelector";
import { contextoBase } from "@/lib/plantillas-marcadores";
import { useConfirmacionFirma } from "@/components/ConfirmacionIdentidadFirma";
import { DocumentoMemorando } from "@/components/memorandos/DocumentoMemorando";
import { siglaDependencia, type PersonaMemorando } from "@/lib/memorandos-formato";

type Dependencia = { id: string; nombre: string; codigo?: string };
type Subserie = { id: string; codigo: string; nombre: string };
type Serie = { id: string; codigo: string; nombre: string; dependenciaId: string | null; dependenciaNombre?: string | null; subseries: Subserie[] };
export type PersonaOpcion = { id: string; nombre: string; cargo: string; dependenciaId: string | null; dirige: boolean };
export type RespuestaA = { id: string; radicado: string; asunto: string; contenido: string | null; dependenciaDestinoId: string; usuarioDestinoId: string | null; proyectoId: string | null };

const PLAZOS = [3, 5, 10, 15];

export function MemorandoForm({
  dependencias,
  series,
  personas,
  remitente,
  dependenciaOrigen: origenInicial,
  origenLibre = false,
  anio,
  ciudad,
  fecha,
  plantillas = [],
  logoUrl,
  respondeA = null,
}: {
  dependencias: Dependencia[];
  series: Serie[];
  personas: PersonaOpcion[];
  remitente: PersonaMemorando & { id: string };
  dependenciaOrigen: Dependencia;
  /** Solo el administrador: elige desde qué oficina firma (pruebas). */
  origenLibre?: boolean;
  anio: number;
  ciudad: string;
  fecha: string;
  plantillas?: PlantillaOpcion[];
  logoUrl?: string | null;
  respondeA?: RespuestaA | null;
}) {
  const router = useRouter();
  const { confirmarIdentidad, dialogo } = useConfirmacionFirma("SGDEA");
  const [dependenciaOrigenId, setDependenciaOrigenId] = useState(origenInicial.id);
  const dependenciaOrigen = dependencias.find((d) => d.id === dependenciaOrigenId) ?? origenInicial;
  const numeroPrevio = `${siglaDependencia(dependenciaOrigen.nombre, dependenciaOrigen.codigo)} – ___ /${anio}`;
  const [dependenciaDestinoId, setDependenciaDestinoId] = useState(respondeA?.dependenciaDestinoId ?? "");
  const [usuarioDestinoId, setUsuarioDestinoId] = useState(respondeA?.usuarioDestinoId ?? "");
  const [asunto, setAsunto] = useState(respondeA ? `Respuesta a ${respondeA.radicado} — ${respondeA.asunto}` : "");
  const [plazo, setPlazo] = useState(0);
  const [contenido, setContenido] = useState(respondeA?.contenido ?? "");
  const [proyectoId, setProyectoId] = useState(respondeA?.proyectoId ?? "");
  const [revisoId, setRevisoId] = useState("");
  const [folios, setFolios] = useState(1);
  const [serieId, setSerieId] = useState("");
  const [subserieId, setSubserieId] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<{ pct: number; texto: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const destinatarios = useMemo(
    () => personas.filter((u) => u.dependenciaId === dependenciaDestinoId).sort((a, b) => Number(b.dirige) - Number(a.dirige) || a.nombre.localeCompare(b.nombre)),
    [personas, dependenciaDestinoId]
  );
  const colaboradores = useMemo(() => personas.filter((u) => u.dependenciaId === dependenciaOrigen.id && u.id !== remitente.id), [personas, dependenciaOrigen.id, remitente.id]);
  const porId = (id: string) => personas.find((p) => p.id === id) ?? null;
  const persona = (p: PersonaOpcion | null): PersonaMemorando | null => (p ? { nombre: p.nombre, cargo: p.cargo } : null);

  function cambiarDependenciaDestino(nuevoId: string) {
    setDependenciaDestinoId(nuevoId);
    const jefe = personas.find((u) => u.dependenciaId === nuevoId && u.dirige);
    setUsuarioDestinoId(jefe?.id ?? "");
  }

  function agregarArchivos(lista: FileList | null) {
    if (!lista) return;
    const { validos, error: err } = filtrarLoteSGDEA(Array.from(lista), archivos.length);
    if (err) setError(err);
    if (validos.length) setArchivos((prev) => [...prev, ...validos]);
  }

  async function firmarYEnviar() {
    setError(null);
    if (!dependenciaDestinoId) return setError("Indique la dependencia de destino.");
    if (!usuarioDestinoId) return setError("Indique a quién va dirigido el memorando (PARA).");
    if (!asunto.trim()) return setError("El asunto es obligatorio.");
    if (!contenido.trim()) return setError("El cuerpo del memorando es obligatorio: es lo que queda firmado.");
    if (!(await confirmarIdentidad({ detalle: `Memorando: ${asunto.trim()}` }))) return;
    setEnviando(true);
    setProgreso({ pct: 0, texto: "Preparando…" });
    try {
      const documentos = await subirDocumentosConProgreso(archivos, subirArchivoMemorando, crypto.randomUUID(), (pct, texto) => setProgreso({ pct, texto }), "Asignando el número y firmando…");
      const resp = await fetch("/api/memorandos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asunto: asunto.trim(),
          contenido: contenido.trim(),
          folios,
          dependenciaOrigenId: origenLibre ? dependenciaOrigenId : null,
          dependenciaDestinoId,
          usuarioDestinoId,
          proyectoId: proyectoId || null,
          revisoId: revisoId || null,
          plazoRespuestaDias: plazo || null,
          respondeAId: respondeA?.id ?? null,
          serieId: serieId || null,
          subserieId: subserieId || null,
          documentos,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudo enviar el memorando.");
      setProgreso({ pct: 100, texto: "Listo." });
      router.push(`/memorandos/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el memorando.");
      setProgreso(null);
      setEnviando(false);
    }
  }

  const inputCls = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";
  const tarjeta = "rounded-2xl border border-stone-200 bg-white p-4 shadow-soft";

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {respondeA && (
          <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">
            Responde al memorando <span className="font-semibold">{respondeA.radicado}</span>. Al enviarlo, ese memorando queda como respondido.
          </div>
        )}

        <section className={tarjeta}>
          <EncabezadoPaso numero={1} icono={<ArrowRightLeft className="h-4 w-4" aria-hidden />} titulo="Para" descripcion={`Lo firma y envía ${remitente.nombre} desde ${dependenciaOrigen.nombre}.`} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {origenLibre && (
              <div className="sm:col-span-2">
                <Field label="Oficina de origen (DE)" required help="Como administrador puede elegir desde qué oficina firma, para hacer pruebas.">
                  <select
                    value={dependenciaOrigenId}
                    onChange={(e) => {
                      setDependenciaOrigenId(e.target.value);
                      setProyectoId("");
                      setRevisoId("");
                      if (e.target.value === dependenciaDestinoId) cambiarDependenciaDestino("");
                    }}
                    className={inputCls}
                  >
                    {dependencias.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            <Field label="Dependencia de destino" required>
              <select value={dependenciaDestinoId} onChange={(e) => cambiarDependenciaDestino(e.target.value)} className={inputCls}>
                <option value="">— Seleccione —</option>
                {dependencias
                  .filter((d) => d.id !== dependenciaOrigen.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Destinatario (PARA)" required help="Casi siempre quien dirige esa oficina; él lo asigna a sus colaboradores.">
              <select value={usuarioDestinoId} onChange={(e) => setUsuarioDestinoId(e.target.value)} className={inputCls} disabled={!dependenciaDestinoId}>
                <option value="">— Seleccione —</option>
                {destinatarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} · {u.cargo}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Respuesta" help="Si requiere respuesta, el destinatario lo verá como pendiente con su plazo y recibirá el aviso.">
                <select value={plazo} onChange={(e) => setPlazo(Number(e.target.value))} className={`${inputCls} max-w-sm`}>
                  <option value={0}>No requiere respuesta (informativo)</option>
                  {PLAZOS.map((d) => (
                    <option key={d} value={d}>
                      Requiere respuesta en {d} días hábiles
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </section>

        <section className={tarjeta}>
          <EncabezadoPaso numero={2} icono={<FileText className="h-4 w-4" aria-hidden />} titulo="Asunto y cuerpo" descripcion="Puede partir de una plantilla. Lo que escriba se ve a la derecha tal como saldrá." />
          <div className="space-y-3">
            <Field label="Asunto" required>
              <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={inputCls} />
            </Field>
            <PlantillaSelector
              plantillas={plantillas}
              contenidoActual={contenido}
              asuntoActual={asunto}
              onCargar={setContenido}
              onCargarAsunto={setAsunto}
              contexto={{
                ...contextoBase(),
                ASUNTO: asunto,
                REMITENTE: remitente.nombre,
                FUNCIONARIO: remitente.nombre,
                DESTINATARIO: porId(usuarioDestinoId)?.nombre ?? dependencias.find((d) => d.id === dependenciaDestinoId)?.nombre ?? "",
                DEPENDENCIA: dependenciaOrigen.nombre,
              }}
            />
            <Field label="Cuerpo" required help="Un renglón en blanco separa párrafos. **texto** sale en negrilla. Las filas que empiezan y terminan en | forman una tabla (la primera es el encabezado).">
              <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={14} className={`${inputCls} font-mono text-[13px]`} placeholder="Cuerpo del memorando…" />
            </Field>
          </div>
        </section>

        <section className={tarjeta}>
          <EncabezadoPaso numero={3} icono={<Users className="h-4 w-4" aria-hidden />} titulo="Proyectó y revisó" descripcion="Opcional. Personas de su oficina que aparecen en el cuadro al pie." />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Proyectó">
              <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={inputCls}>
                <option value="">— Nadie más —</option>
                {colaboradores.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Revisó">
              <select value={revisoId} onChange={(e) => setRevisoId(e.target.value)} className={inputCls}>
                <option value="">— Nadie más —</option>
                {colaboradores.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className={tarjeta}>
          <EncabezadoPaso numero={4} icono={<FolderTree className="h-4 w-4" aria-hidden />} titulo="Clasificación (TRD)" />
          <SectionHelp>Opcional. Elija la serie y la subserie de su dependencia.</SectionHelp>
          <BuscadorSubserieTRD
            series={series}
            serieId={serieId}
            subserieId={subserieId}
            dependenciaId={dependenciaOrigen.id}
            dependenciaControlada
            onChange={(s, ss) => {
              setSerieId(s);
              setSubserieId(ss);
            }}
          />
        </section>

        <section className={tarjeta}>
          <EncabezadoPaso numero={5} icono={<Paperclip className="h-4 w-4" aria-hidden />} titulo="Anexos" descripcion={`Hasta ${MAX_ARCHIVOS_LOTE} archivos de máximo ${TAMANO_MAXIMO_SGDEA_MB} MB cada uno. Se guardan en el NAS.`} />
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-stone-200 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50">
              <Upload className="h-4 w-4" aria-hidden />
              Agregar archivos
              <input type="file" multiple accept={ACCEPT_DOCUMENTOS} className="hidden" onChange={(e) => agregarArchivos(e.target.files)} />
            </label>
            <label className="text-sm text-stone-600">
              N.º de folios{" "}
              <input type="number" min={1} value={folios} onChange={(e) => setFolios(Math.max(1, Number(e.target.value) || 1))} className="ml-1 w-20 rounded-md border border-stone-200 px-2 py-1.5 text-sm" />
            </label>
          </div>
          {archivos.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {archivos.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-1.5 text-sm">
                  <span className="truncate text-stone-700" title={f.name}>
                    {f.name}
                  </span>
                  <button type="button" aria-label={`Quitar ${f.name}`} onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))} className="flex-none text-stone-400 hover:text-red-600">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {progreso && <BarraProgresoEnvio pct={progreso.pct} texto={progreso.texto} />}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={firmarYEnviar}
            disabled={enviando}
            className="inline-flex items-center gap-2 rounded-md bg-acento-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
            {enviando ? "Firmando y enviando…" : "Firmar y enviar"}
          </button>
          <span className="text-xs text-stone-500">Se asigna el número de su oficina y se firma electrónicamente en el mismo paso.</span>
        </div>
        {dialogo}
      </div>

      <div className="xl:sticky xl:top-4 xl:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Vista previa</p>
        <div className="max-h-[85vh] overflow-auto rounded-2xl border border-stone-200 bg-stone-100 p-3 shadow-soft">
          <div className="shadow-sm">
            <DocumentoMemorando
              logoUrl={logoUrl}
              d={{
                numero: numeroPrevio,
                ciudad,
                fecha,
                para: persona(porId(usuarioDestinoId)),
                de: { nombre: remitente.nombre, cargo: remitente.cargo },
                asunto,
                cuerpo: contenido,
                proyecto: persona(porId(proyectoId)),
                reviso: persona(porId(revisoId)),
                oficina: dependenciaOrigen.nombre,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
