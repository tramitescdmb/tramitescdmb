"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Lock, Monitor, RotateCcw, Save, Send, Smartphone, XCircle } from "lucide-react";
import { EditorHtmlCorreo, type EditorHtmlHandle } from "@/components/admin/EditorHtmlCorreo";
import {
  definicionPlantilla,
  DISENO_PREDETERMINADO,
  ejemplosDe,
  envolverCorreo,
  escaparHtmlPlantilla,
  fechaEnLetras,
  renderizarDiseno,
  renderizarPlantilla,
  validarDiseno,
  validarPlantilla,
  VARIABLES_GLOBALES,
  variablesDe,
  type ClavePlantilla,
  type ContenidoPlantilla,
  type DefinicionPlantilla,
  type DisenoCorreo,
  type ResultadoValidacion,
  type Valores,
  type VariablePlantilla,
} from "@/lib/plantillas-correo-base";

const CAMPO = "w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-sm focus:border-cdmb-400 focus:outline-none focus:ring-2 focus:ring-cdmb-100";
const BOTON = "inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50";
const BOTON_PRINCIPAL = "inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700 disabled:opacity-50";
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type OpcionPrueba = { clave: string; etiqueta: string };
type Comun = { personalizada: boolean; urlEfectiva: string | null; correoPrueba: string; opcionesPrueba: OpcionPrueba[]; actualizado: string | null };

type Estado = { tipo: "ok" | "error"; mensaje: string; errores?: string[] } | null;

function globales(url: string | null): Valores {
  const base = url ?? "https://tramites.cdmb.gov.co";
  return { FECHA_HOY: fechaEnLetras(new Date()), URL_PLATAFORMA: base, ENLACE: `${base}/firmas/buzon` };
}

function documentoPrevia(html: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:20px 16px;background:#f5f5f4}main{background:#fff;border:1px solid #e7e5e4;border-radius:8px;padding:24px 20px;max-width:600px;margin:0 auto}img{max-width:100%}</style></head><body><main>${html}</main></body></html>`;
}

function useCambiosSinGuardar(sucio: boolean) {
  useEffect(() => {
    if (!sucio) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sucio]);
}

function VistaPrevia({ asunto, html }: { asunto: string; html: string }) {
  const [ancho, setAncho] = useState<"pc" | "cel">("pc");
  return (
    <section aria-label="Vista previa" className="rounded-md border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-3 py-2">
        <p className="text-sm font-semibold text-stone-900">Vista previa</p>
        <span className="text-[11px] text-stone-500">con datos de ejemplo</span>
        <div role="group" aria-label="Ancho de la vista previa" className="ml-auto inline-flex rounded-md border border-stone-200 p-0.5">
          <button type="button" aria-pressed={ancho === "pc"} onClick={() => setAncho("pc")} title="Computador" className="rounded px-1.5 py-0.5 text-stone-500 aria-pressed:bg-stone-800 aria-pressed:text-white">
            <Monitor className="h-3.5 w-3.5" aria-label="Computador" />
          </button>
          <button type="button" aria-pressed={ancho === "cel"} onClick={() => setAncho("cel")} title="Celular" className="rounded px-1.5 py-0.5 text-stone-500 aria-pressed:bg-stone-800 aria-pressed:text-white">
            <Smartphone className="h-3.5 w-3.5" aria-label="Celular" />
          </button>
        </div>
      </div>
      <div className="border-b border-stone-100 px-3 py-2 text-xs">
        <span className="text-stone-500">Asunto: </span>
        <span className="font-medium text-stone-900">{asunto || "—"}</span>
      </div>
      <div className="flex justify-center bg-stone-100 p-2">
        <iframe title="Vista previa del correo" sandbox="" srcDoc={documentoPrevia(html)} className="h-[620px] rounded border border-stone-200 bg-white transition-[width]" style={{ width: ancho === "pc" ? "100%" : 375 }} />
      </div>
    </section>
  );
}

function PanelPalabras({ variables, usadas, alInsertar }: { variables: VariablePlantilla[]; usadas: Set<string>; alInsertar: (texto: string) => void }) {
  const propias = variables.filter((v) => !VARIABLES_GLOBALES.some((g) => g.clave === v.clave));
  const opcional = (variables.find((v) => !v.obligatoria && !v.html && v.descripcion.includes("vacía")) ?? variables.find((v) => !v.obligatoria && !v.html))?.clave ?? "ENLACE";
  const fila = (v: VariablePlantilla) => {
    const usada = usadas.has(v.clave);
    return (
      <li key={v.clave} className="flex items-start gap-2 py-1.5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => alInsertar(`[${v.clave}]`)}
          title={`Insertar [${v.clave}] donde está el cursor`}
          className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
            v.obligatoria ? (usada ? "border-cdmb-300 bg-cdmb-50 text-cdmb-800" : "border-red-300 bg-red-50 text-red-700") : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-white"
          }`}
        >
          {v.obligatoria && <Lock className="h-3 w-3" aria-label="Obligatoria" />}[{v.clave}]
        </button>
        <span className="text-[11px] leading-snug text-stone-600">
          {v.descripcion}
          {v.html && <span className="ml-1 rounded-sm bg-violet-50 px-1 text-[10px] font-medium text-violet-700">lista con formato</span>}
          {v.obligatoria && !usada && <span className="ml-1 font-medium text-red-700">· falta en el cuerpo</span>}
        </span>
      </li>
    );
  };
  return (
    <section aria-label="Palabras reservadas" className="rounded-md border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-3 py-2">
        <p className="text-sm font-semibold text-stone-900">Palabras reservadas</p>
        <p className="text-[11px] text-stone-500">Clic para insertarla donde está el cursor.</p>
      </div>
      {propias.length > 0 && <ul className="divide-y divide-stone-100 px-3">{propias.map(fila)}</ul>}
      <p className="border-t border-stone-100 px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">En todos los correos</p>
      <ul className="divide-y divide-stone-100 px-3">{VARIABLES_GLOBALES.map(fila)}</ul>
      <div className="space-y-1 border-t border-stone-100 px-3 py-2 text-[11px] text-stone-600">
        {variables.some((v) => v.obligatoria) && (
          <p>
            <Lock className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden />
            Las obligatorias deben quedar en el cuerpo; sin ellas no se puede guardar.
          </p>
        )}
        <p>
          Texto que solo aparece si un dato tiene valor: <code className="rounded bg-stone-100 px-1 font-mono">[SI:{opcional}]…[{opcional}]…[/SI:{opcional}]</code>. Si está vacío:{" "}
          <code className="rounded bg-stone-100 px-1 font-mono">[NO:{opcional}]…[/NO:{opcional}]</code>.
        </p>
      </div>
    </section>
  );
}

function Validacion({ v }: { v: ResultadoValidacion }) {
  if (v.ok)
    return (
      <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Lista para guardar
      </p>
    );
  return (
    <ul className="space-y-0.5 text-xs text-red-700">
      {v.errores.map((e) => (
        <li key={e} className="flex items-start gap-1.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {e}
        </li>
      ))}
    </ul>
  );
}

function Mensaje({ estado }: { estado: Estado }) {
  if (!estado) return null;
  const ok = estado.tipo === "ok";
  return (
    <div role="status" className={`rounded-md px-3 py-2 text-sm ${ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
      <p className="flex items-center gap-1.5">
        {ok ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />} {estado.mensaje}
      </p>
      {estado.errores && estado.errores.length > 0 && (
        <ul className="mt-1 list-disc pl-6 text-xs">
          {estado.errores.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BarraAcciones({
  sucio,
  valido,
  personalizada,
  ocupado,
  actualizado,
  alGuardar,
  alRestaurar,
  alDescartar,
}: {
  sucio: boolean;
  valido: boolean;
  personalizada: boolean;
  ocupado: boolean;
  actualizado: string | null;
  alGuardar: () => void;
  alRestaurar: () => void;
  alDescartar: () => void;
}) {
  const [confirmar, setConfirmar] = useState(false);
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-stone-200 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur">
      <span className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${personalizada ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>
        {personalizada ? "Personalizada" : "Predeterminada"}
      </span>
      {actualizado && <span className="text-xs text-stone-500">{actualizado}</span>}
      {sucio && <span className="text-xs font-medium text-amber-700">Cambios sin guardar</span>}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {sucio && (
          <button type="button" disabled={ocupado} onClick={alDescartar} className={BOTON}>
            Descartar cambios
          </button>
        )}
        {personalizada &&
          (confirmar ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-stone-700">
              ¿Volver a la versión predeterminada?
              <button type="button" disabled={ocupado} onClick={() => { setConfirmar(false); alRestaurar(); }} className={`${BOTON} border-red-200 text-red-700 hover:bg-red-50`}>
                Sí, restaurar
              </button>
              <button type="button" onClick={() => setConfirmar(false)} className={BOTON}>
                No
              </button>
            </span>
          ) : (
            <button type="button" disabled={ocupado} onClick={() => setConfirmar(true)} className={BOTON}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restaurar predeterminada
            </button>
          ))}
        <button type="button" disabled={!sucio || !valido || ocupado} onClick={alGuardar} className={BOTON_PRINCIPAL}>
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />} Guardar
        </button>
      </div>
    </div>
  );
}

function PanelPrueba({ correoInicial, opciones, alEnviar }: { correoInicial: string; opciones: OpcionPrueba[]; alEnviar: (clave: string, destino: string) => Promise<{ ok: boolean; mensaje: string }> }) {
  const [correo, setCorreo] = useState(correoInicial);
  const [clave, setClave] = useState(opciones[0]?.clave ?? "");
  const [estado, setEstado] = useState<{ ok: boolean; mensaje: string } | "enviando" | null>(null);
  const valido = CORREO.test(correo.trim());
  return (
    <section aria-label="Enviar una prueba" className="rounded-md border border-stone-200 bg-white px-3 py-3">
      <p className="text-sm font-semibold text-stone-900">Enviar una prueba</p>
      <p className="mb-2 text-[11px] text-stone-500">Se envía la versión en edición, aunque no esté guardada.</p>
      <div className="space-y-2">
        <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@cdmb.gov.co" aria-label="Correo de prueba" className={CAMPO} />
        {opciones.length > 1 && (
          <select value={clave} onChange={(e) => setClave(e.target.value)} aria-label="Datos de la prueba" className={CAMPO}>
            {opciones.map((o) => (
              <option key={o.clave} value={o.clave}>{o.etiqueta}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          disabled={!valido || estado === "enviando" || !clave}
          onClick={async () => {
            setEstado("enviando");
            setEstado(await alEnviar(clave, correo.trim()));
          }}
          className={BOTON}
        >
          {estado === "enviando" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />} Enviar prueba
        </button>
        {estado && estado !== "enviando" && <p className={`text-xs ${estado.ok ? "text-emerald-700" : "text-red-700"}`}>{estado.mensaje}</p>}
      </div>
    </section>
  );
}

async function enviarPrueba(clave: string, destino: string, borrador: unknown): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const r = await fetch("/api/admin/correo/prueba", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave, destino, borrador }) });
    return ((await r.json().catch(() => null)) as { ok: boolean; mensaje: string } | null) ?? { ok: false, mensaje: "Respuesta inválida del servidor." };
  } catch {
    return { ok: false, mensaje: "No se pudo contactar el servidor." };
  }
}

async function guardar(datos: Record<string, string>): Promise<Estado> {
  try {
    const r = await fetch("/api/admin/correo/plantillas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) });
    const d = (await r.json().catch(() => null)) as { ok: boolean; mensaje: string; errores?: string[] } | null;
    if (!d) return { tipo: "error", mensaje: "Respuesta inválida del servidor." };
    return { tipo: d.ok ? "ok" : "error", mensaje: d.mensaje, errores: d.errores };
  } catch {
    return { tipo: "error", mensaje: "No se pudo contactar el servidor." };
  }
}

async function restaurar(clave: string): Promise<Estado> {
  try {
    const r = await fetch(`/api/admin/correo/plantillas?clave=${encodeURIComponent(clave)}`, { method: "DELETE" });
    const d = (await r.json().catch(() => null)) as { ok: boolean; mensaje: string } | null;
    return d ? { tipo: d.ok ? "ok" : "error", mensaje: d.mensaje } : { tipo: "error", mensaje: "Respuesta inválida del servidor." };
  } catch {
    return { tipo: "error", mensaje: "No se pudo contactar el servidor." };
  }
}

type Campo = "asunto" | "titulo" | "boton" | "cuerpo" | "antetitulo" | "encabezado" | "pie";

function insertarEnInput(el: HTMLInputElement | null, actual: string, texto: string, poner: (v: string) => void) {
  const inicio = el?.selectionStart ?? actual.length;
  const fin = el?.selectionEnd ?? inicio;
  poner(actual.slice(0, inicio) + texto + actual.slice(fin));
  requestAnimationFrame(() => {
    el?.focus();
    el?.setSelectionRange(inicio + texto.length, inicio + texto.length);
  });
}

function usadasEn(...textos: string[]): Set<string> {
  return new Set(textos.flatMap((t) => [...t.matchAll(/\[(?:SI:|NO:)?([A-Z][A-Z0-9_]*)\]/g)].map((m) => m[1]!)));
}

export function EditorPlantillaCorreo({ clave, inicial, diseno, ...comun }: Comun & { clave: ClavePlantilla; inicial: ContenidoPlantilla; diseno: DisenoCorreo }) {
  const router = useRouter();
  const def = definicionPlantilla(clave);
  const variables = useMemo(() => variablesDe(clave), [clave]);
  const [guardado, setGuardado] = useState(inicial);
  const [c, setC] = useState(inicial);
  const [estado, setEstado] = useState<Estado>(null);
  const [ocupado, setOcupado] = useState(false);
  const [foco, setFoco] = useState<Campo>("cuerpo");
  const cuerpo = useRef<EditorHtmlHandle>(null);
  const entradas = { asunto: useRef<HTMLInputElement>(null), titulo: useRef<HTMLInputElement>(null), boton: useRef<HTMLInputElement>(null) };

  const sucio = c.asunto !== guardado.asunto || c.titulo !== guardado.titulo || c.cuerpo !== guardado.cuerpo || c.boton !== guardado.boton;
  useCambiosSinGuardar(sucio);
  const validacion = validarPlantilla(clave, c);
  const usadas = usadasEn(c.cuerpo);

  const previa = useMemo(() => {
    const valores = { ...ejemplosDe(variables), ...globales(comun.urlEfectiva) };
    const r = renderizarPlantilla(clave, c, valores);
    const enlace = !def.sinEnlace && r.boton ? { texto: r.boton, url: String(valores.ENLACE) } : undefined;
    return { asunto: r.asunto, html: envolverCorreo(escaparHtmlPlantilla(r.titulo), r.cuerpoHtml, enlace, renderizarDiseno(diseno, valores)) };
  }, [c, clave, def.sinEnlace, diseno, variables, comun.urlEfectiva]);

  function insertar(texto: string) {
    if (foco === "cuerpo") return cuerpo.current?.insertar(texto);
    if (foco === "asunto" || foco === "titulo" || foco === "boton") {
      const campo = foco;
      insertarEnInput(entradas[campo].current, c[campo], texto, (v) => setC((p) => ({ ...p, [campo]: v })));
    }
  }

  const campoTexto = (campo: "asunto" | "titulo" | "boton", etiqueta: string, ayuda?: string) => (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-stone-600">{etiqueta}</span>
      <input ref={entradas[campo]} value={c[campo]} onFocus={() => setFoco(campo)} onChange={(e) => setC((p) => ({ ...p, [campo]: e.target.value }))} className={CAMPO} />
      {ayuda && <span className="mt-1 block text-[11px] text-stone-500">{ayuda}</span>}
    </label>
  );

  return (
    <div className="space-y-3">
      <BarraAcciones
        sucio={sucio}
        valido={validacion.ok}
        personalizada={comun.personalizada}
        ocupado={ocupado}
        actualizado={comun.actualizado}
        alDescartar={() => setC(guardado)}
        alGuardar={async () => {
          setOcupado(true);
          const r = await guardar({ clave, ...c });
          setOcupado(false);
          setEstado(r);
          if (r?.tipo === "ok") {
            setGuardado(c);
            router.refresh();
          }
        }}
        alRestaurar={async () => {
          setOcupado(true);
          const r = await restaurar(clave);
          setOcupado(false);
          setEstado(r);
          if (r?.tipo === "ok") {
            const predeterminada = { asunto: def.asunto, titulo: def.titulo, cuerpo: def.cuerpo, boton: def.boton };
            setC(predeterminada);
            setGuardado(predeterminada);
            router.refresh();
          }
        }}
      />
      <Mensaje estado={estado} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <section aria-label="Contenido de la plantilla" className="space-y-3 rounded-md border border-stone-200 bg-white px-4 py-3">
            {campoTexto("asunto", "Asunto")}
            {campoTexto("titulo", "Título (encabezado del mensaje)")}
            <EditorHtmlCorreo
              ref={cuerpo}
              id={`cuerpo-${clave}`}
              etiqueta="Cuerpo"
              valor={c.cuerpo}
              alCambiar={(v) => setC((p) => ({ ...p, cuerpo: v }))}
              alEnfocar={() => setFoco("cuerpo")}
              ayuda="Lo pegado entra como texto sin formato."
            />
            {def.sinEnlace ? (
              <p className="text-[11px] text-stone-500">Este correo no lleva botón.</p>
            ) : (
              campoTexto("boton", "Texto del botón", "Vacío: el correo sale sin botón.")
            )}
            <div className="border-t border-stone-100 pt-2">
              <Validacion v={validacion} />
            </div>
          </section>
          <PanelPalabras variables={variables} usadas={usadas} alInsertar={insertar} />
        </div>
        <div className="space-y-3">
          <VistaPrevia asunto={previa.asunto} html={previa.html} />
          <PanelPrueba
            correoInicial={comun.correoPrueba}
            opciones={comun.opcionesPrueba}
            alEnviar={(claveMatriz, destino) => enviarPrueba(claveMatriz, destino, { plantilla: { clave, ...c } })}
          />
        </div>
      </div>
    </div>
  );
}

export function EditorDisenoCorreo({ inicial, ...comun }: Comun & { inicial: DisenoCorreo }) {
  const router = useRouter();
  const [guardado, setGuardado] = useState(inicial);
  const [d, setD] = useState(inicial);
  const [estado, setEstado] = useState<Estado>(null);
  const [ocupado, setOcupado] = useState(false);
  const [foco, setFoco] = useState<Campo>("encabezado");
  const [muestra, setMuestra] = useState<ClavePlantilla>("FIRMA_SOLICITADA_TRAMITES");
  const encabezado = useRef<EditorHtmlHandle>(null);
  const pie = useRef<EditorHtmlHandle>(null);
  const antetitulo = useRef<HTMLInputElement>(null);

  const sucio = d.antetitulo !== guardado.antetitulo || d.encabezado !== guardado.encabezado || d.pie !== guardado.pie;
  useCambiosSinGuardar(sucio);
  const validacion = validarDiseno(d);

  const previa = useMemo(() => {
    const def = definicionPlantilla(muestra);
    const valores = { ...ejemplosDe(variablesDe(muestra)), ...globales(comun.urlEfectiva) };
    const r = renderizarPlantilla(muestra, def, valores);
    const enlace = !def.sinEnlace && r.boton ? { texto: r.boton, url: String(valores.ENLACE) } : undefined;
    return { asunto: r.asunto, html: envolverCorreo(escaparHtmlPlantilla(r.titulo), r.cuerpoHtml, enlace, renderizarDiseno(d, valores)) };
  }, [d, muestra, comun.urlEfectiva]);

  function insertar(texto: string) {
    if (foco === "encabezado") return encabezado.current?.insertar(texto);
    if (foco === "pie") return pie.current?.insertar(texto);
    if (foco === "antetitulo") insertarEnInput(antetitulo.current, d.antetitulo, texto, (v) => setD((p) => ({ ...p, antetitulo: v })));
  }

  const defMuestra: DefinicionPlantilla = definicionPlantilla(muestra);
  const opcionMuestra =
    comun.opcionesPrueba.find((o) => (defMuestra.modulo ? o.clave === `${defMuestra.modulo}.${defMuestra.eventos[0]}` : o.clave.endsWith(`.${defMuestra.eventos[0]}`)))?.clave ?? comun.opcionesPrueba[0]?.clave ?? "";

  return (
    <div className="space-y-3">
      <BarraAcciones
        sucio={sucio}
        valido={validacion.ok}
        personalizada={comun.personalizada}
        ocupado={ocupado}
        actualizado={comun.actualizado}
        alDescartar={() => setD(guardado)}
        alGuardar={async () => {
          setOcupado(true);
          const r = await guardar({ clave: "DISENO", ...d });
          setOcupado(false);
          setEstado(r);
          if (r?.tipo === "ok") {
            setGuardado(d);
            router.refresh();
          }
        }}
        alRestaurar={async () => {
          setOcupado(true);
          const r = await restaurar("DISENO");
          setOcupado(false);
          setEstado(r);
          if (r?.tipo === "ok") {
            setD(DISENO_PREDETERMINADO);
            setGuardado(DISENO_PREDETERMINADO);
            router.refresh();
          }
        }}
      />
      <Mensaje estado={estado} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <section aria-label="Diseño general" className="space-y-3 rounded-md border border-stone-200 bg-white px-4 py-3">
            <EditorHtmlCorreo
              ref={encabezado}
              id="diseno-encabezado"
              etiqueta="Encabezado (arriba de todos los correos)"
              valor={d.encabezado}
              alCambiar={(v) => setD((p) => ({ ...p, encabezado: v }))}
              alEnfocar={() => setFoco("encabezado")}
              altoMinimo={110}
              ayuda="Por ejemplo, el logo de la Corporación."
            />
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-stone-600">Antetítulo (línea verde sobre el título)</span>
              <input ref={antetitulo} value={d.antetitulo} onFocus={() => setFoco("antetitulo")} onChange={(e) => setD((p) => ({ ...p, antetitulo: e.target.value }))} className={CAMPO} />
            </label>
            <EditorHtmlCorreo
              ref={pie}
              id="diseno-pie"
              etiqueta="Pie de página (debajo de todos los correos)"
              valor={d.pie}
              alCambiar={(v) => setD((p) => ({ ...p, pie: v }))}
              alEnfocar={() => setFoco("pie")}
              altoMinimo={110}
              ayuda="Datos de contacto o aviso de confidencialidad."
            />
            <div className="border-t border-stone-100 pt-2">
              <Validacion v={validacion} />
            </div>
          </section>
          <PanelPalabras variables={VARIABLES_GLOBALES} usadas={usadasEn(d.antetitulo, d.encabezado, d.pie)} alInsertar={insertar} />
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs text-stone-600">
            <span className="shrink-0">Ver con la plantilla</span>
            <select value={muestra} onChange={(e) => setMuestra(e.target.value as ClavePlantilla)} className="min-w-0 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-sm">
              {(["FIRMA_SOLICITADA_TRAMITES", "RESUMEN_VENCIMIENTOS", "PQRSD_RADICADO", "VISITA_PROGRAMADA", "TRAMITE_RADICADO"] as const).map((k) => (
                <option key={k} value={k}>{definicionPlantilla(k).nombre}</option>
              ))}
            </select>
          </label>
          <VistaPrevia asunto={previa.asunto} html={previa.html} />
          <PanelPrueba
            key={opcionMuestra}
            correoInicial={comun.correoPrueba}
            opciones={[{ clave: opcionMuestra, etiqueta: "" }]}
            alEnviar={(claveMatriz, destino) => enviarPrueba(claveMatriz, destino, { diseno: d })}
          />
        </div>
      </div>
    </div>
  );
}
