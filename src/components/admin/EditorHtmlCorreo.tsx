"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Bold,
  Code2,
  Eye,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Pilcrow,
  RemoveFormatting,
  SquareMousePointer,
  TextQuote,
  Underline,
  Upload,
} from "lucide-react";
import { subirAUrlFirmada } from "@/lib/supabase-browser";

export type EditorHtmlHandle = { insertar: (texto: string) => void };

type Props = {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (html: string) => void;
  alEnfocar?: () => void;
  altoMinimo?: number;
  ayuda?: string;
};

const BOTON_HERRAMIENTA =
  "inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded px-1.5 text-xs text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-40 aria-pressed:bg-cdmb-50 aria-pressed:text-cdmb-700";
const CAMPO = "w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-sm";
const ESTILO_BOTON_ENLACE = "background:#038F67;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block";

const ANCHOS = [
  { id: "600", etiqueta: "Ancho completo (600 px)" },
  { id: "300", etiqueta: "Mediano (300 px)" },
  { id: "150", etiqueta: "Pequeño (150 px)" },
  { id: "", etiqueta: "Tamaño original" },
] as const;

function escapar(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function htmlImagen(d: { url: string; alt: string; ancho: string; alineacion: "left" | "center" }) {
  const ancho = d.ancho ? ` width="${d.ancho}"` : "";
  const estilo = `max-width:100%;height:auto;border:0;display:inline-block${d.ancho ? `;width:${d.ancho}px` : ""}`;
  return `<p style="margin:0 0 10px;text-align:${d.alineacion}"><img src="${escapar(d.url)}" alt="${escapar(d.alt)}"${ancho} style="${estilo}"></p>`;
}

async function subirImagen(file: File): Promise<string> {
  const firma = await fetch("/api/admin/correo/plantillas/imagen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, tipo: file.type, tamano: file.size }),
  });
  const datos = (await firma.json().catch(() => ({}))) as { path?: string; token?: string; url?: string; error?: string };
  if (!firma.ok || !datos.path || !datos.token || !datos.url) throw new Error(datos.error || "No se pudo preparar la subida de la imagen.");
  const { error } = await subirAUrlFirmada("branding", datos.path, datos.token, file);
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);
  return datos.url;
}

type Ventana = null | "enlace" | "imagen";

export const EditorHtmlCorreo = forwardRef<EditorHtmlHandle, Props>(function EditorHtmlCorreo({ id, etiqueta, valor, alCambiar, alEnfocar, altoMinimo = 220, ayuda }, ref) {
  const [modo, setModo] = useState<"visual" | "html">("visual");
  const [ventana, setVentana] = useState<Ventana>(null);
  const visual = useRef<HTMLDivElement>(null);
  const codigo = useRef<HTMLTextAreaElement>(null);
  const emitido = useRef<string | null>(null);
  const seleccion = useRef<Range | null>(null);

  // El contenido del editor visual solo se reescribe al cambiar de modo o si el valor cambia desde
  // fuera (p. ej. «Restaurar»), para no perder la posición del cursor mientras se escribe.
  useEffect(() => {
    if (modo !== "visual" || !visual.current) return;
    if (emitido.current === valor && visual.current.innerHTML !== "") return;
    visual.current.innerHTML = valor;
    emitido.current = valor;
  }, [modo, valor]);

  useEffect(() => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      /* navegador sin soporte: se usa el separador por defecto */
    }
  }, []);

  function emitir() {
    if (!visual.current) return;
    const html = visual.current.innerHTML;
    emitido.current = html;
    alCambiar(html);
  }

  function guardarSeleccion() {
    const s = window.getSelection();
    if (s && s.rangeCount > 0 && visual.current?.contains(s.anchorNode)) seleccion.current = s.getRangeAt(0).cloneRange();
  }

  function restaurarSeleccion() {
    const el = visual.current;
    if (!el) return;
    el.focus();
    const s = window.getSelection();
    if (!s) return;
    s.removeAllRanges();
    if (seleccion.current && el.contains(seleccion.current.startContainer)) {
      s.addRange(seleccion.current);
    } else {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      s.addRange(r);
    }
  }

  function comando(nombre: string, argumento?: string) {
    restaurarSeleccion();
    document.execCommand(nombre, false, argumento);
    guardarSeleccion();
    emitir();
  }

  // Se inserta con la API de rangos y no con execCommand("insertHTML"), que reescribe los estilos
  // en línea (quita max-width y height:auto de las imágenes, necesarios en el celular).
  function insertarHtml(html: string) {
    if (modo === "html") return insertarEnCodigo(html);
    const el = visual.current;
    if (!el) return;
    restaurarSeleccion();
    const s = window.getSelection();
    if (!s || s.rangeCount === 0) return;
    const rango = s.getRangeAt(0);
    const fragmento = rango.createContextualFragment(html);
    const ultimo = fragmento.lastChild;
    const esBloque = /^\s*<(p|div|hr|h\d|ul|ol|table)\b/i.test(html);
    let bloque: Node | null = rango.startContainer;
    while (bloque && bloque.parentNode !== el) bloque = bloque.parentNode;
    if (esBloque && bloque && bloque !== el && bloque.nodeType === Node.ELEMENT_NODE) {
      el.insertBefore(fragmento, bloque.nextSibling);
    } else {
      rango.deleteContents();
      rango.insertNode(fragmento);
    }
    if (ultimo) {
      const despues = document.createRange();
      despues.setStartAfter(ultimo);
      despues.collapse(true);
      s.removeAllRanges();
      s.addRange(despues);
    }
    guardarSeleccion();
    emitir();
  }

  function insertarEnCodigo(texto: string) {
    const t = codigo.current;
    if (!t) return;
    const inicio = t.selectionStart ?? valor.length;
    const fin = t.selectionEnd ?? inicio;
    const nuevo = valor.slice(0, inicio) + texto + valor.slice(fin);
    alCambiar(nuevo);
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(inicio + texto.length, inicio + texto.length);
    });
  }

  useImperativeHandle(ref, () => ({
    insertar(texto: string) {
      if (modo === "html") return insertarEnCodigo(texto);
      restaurarSeleccion();
      document.execCommand("insertText", false, texto);
      guardarSeleccion();
      emitir();
    },
  }));

  const herramienta = (titulo: string, Icono: typeof Bold, accion: () => void, extra?: { presionado?: boolean; texto?: string; html?: boolean }) => (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={extra?.presionado}
      disabled={modo === "html" && !extra?.html}
      onMouseDown={(e) => e.preventDefault()}
      onClick={accion}
      className={BOTON_HERRAMIENTA}
    >
      <Icono className="h-3.5 w-3.5" aria-hidden />
      {extra?.texto && <span>{extra.texto}</span>}
    </button>
  );

  return (
    <div className="text-sm">
      <div className="mb-1 flex items-end justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-stone-600">
          {etiqueta}
        </label>
        <div role="group" aria-label="Modo de edición" className="inline-flex rounded-md border border-stone-200 bg-white p-0.5 text-xs">
          {(["visual", "html"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={modo === m}
              onClick={() => {
                if (modo === "visual") emitir();
                setVentana(null);
                setModo(m);
              }}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-stone-600 aria-pressed:bg-stone-800 aria-pressed:text-white"
            >
              {m === "visual" ? <Eye className="h-3 w-3" aria-hidden /> : <Code2 className="h-3 w-3" aria-hidden />}
              {m === "visual" ? "Visual" : "HTML"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-stone-200 bg-white focus-within:border-cdmb-400 focus-within:ring-2 focus-within:ring-cdmb-100">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-stone-100 px-1.5 py-1">
          {herramienta("Negrita", Bold, () => comando("bold"))}
          {herramienta("Cursiva", Italic, () => comando("italic"))}
          {herramienta("Subrayado", Underline, () => comando("underline"))}
          <span className="mx-1 h-4 w-px bg-stone-200" aria-hidden />
          {herramienta("Párrafo", Pilcrow, () => comando("formatBlock", "p"))}
          {herramienta("Subtítulo", Heading3, () => comando("formatBlock", "h3"))}
          {herramienta("Lista con viñetas", List, () => comando("insertUnorderedList"))}
          {herramienta("Lista numerada", ListOrdered, () => comando("insertOrderedList"))}
          <span className="mx-1 h-4 w-px bg-stone-200" aria-hidden />
          {herramienta("Enlace o botón", Link2, () => {
            guardarSeleccion();
            setVentana(ventana === "enlace" ? null : "enlace");
          }, { html: true })}
          {herramienta("Imagen", ImagePlus, () => {
            guardarSeleccion();
            setVentana(ventana === "imagen" ? null : "imagen");
          }, { html: true })}
          {herramienta("Recuadro destacado", TextQuote, () =>
            insertarHtml('<div style="margin:0 0 10px;padding:10px 12px;background:#f0fdf4;border-left:3px solid #038F67">Texto destacado</div><p style="margin:0 0 10px"><br></p>'), { html: true }
          )}
          {herramienta("Línea separadora", Minus, () => insertarHtml('<hr style="border:0;border-top:1px solid #e7e5e4;margin:16px 0">'), { html: true })}
          {herramienta("Quitar formato", RemoveFormatting, () => comando("removeFormat"))}
        </div>

        {ventana === "enlace" && <VentanaEnlace alInsertar={(html, url) => {
              setVentana(null);
              if (html) insertarHtml(html);
              else if (modo === "html") insertarEnCodigo(`<a href="${escapar(url)}" style="color:#038F67">${escapar(url)}</a>`);
              else comando("createLink", url);
            }} alCerrar={() => setVentana(null)} />}
        {ventana === "imagen" && <VentanaImagen alInsertar={(html) => { setVentana(null); insertarHtml(html); }} alCerrar={() => setVentana(null)} />}

        {modo === "visual" ? (
          <div
            id={id}
            ref={visual}
            role="textbox"
            aria-multiline="true"
            aria-label={etiqueta}
            contentEditable
            suppressContentEditableWarning
            onInput={emitir}
            onKeyUp={guardarSeleccion}
            onMouseUp={guardarSeleccion}
            onFocus={alEnfocar}
            onBlur={guardarSeleccion}
            onPaste={(e) => {
              // Lo pegado desde Word o la web entra como texto: su formato rompe el diseño en Outlook.
              const texto = e.clipboardData.getData("text/plain");
              e.preventDefault();
              document.execCommand("insertText", false, texto);
              emitir();
            }}
            style={{ minHeight: altoMinimo }}
            className="correo-editable max-w-none overflow-auto px-3 py-2 text-[14px] leading-relaxed text-stone-900 outline-none [&_a]:text-cdmb-700 [&_a]:underline [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_img]:inline-block [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
          />
        ) : (
          <textarea
            id={id}
            ref={codigo}
            value={valor}
            onChange={(e) => alCambiar(e.target.value)}
            onFocus={alEnfocar}
            spellCheck={false}
            style={{ minHeight: altoMinimo }}
            className="block w-full resize-y rounded-b-md px-3 py-2 font-mono text-xs leading-relaxed text-stone-800 outline-none"
          />
        )}
      </div>
      {ayuda && <p className="mt-1 text-[11px] text-stone-500">{ayuda}</p>}
    </div>
  );
});

function VentanaEnlace({ alInsertar, alCerrar }: { alInsertar: (html: string | null, url: string) => void; alCerrar: () => void }) {
  const [url, setUrl] = useState("https://");
  const [texto, setTexto] = useState("");
  const [comoBoton, setComoBoton] = useState(false);
  const valida = /^(https?:\/\/[^\s]+|mailto:[^\s]+|\[[A-Z_]+\])$/i.test(url.trim());
  return (
    <div className="flex flex-wrap items-end gap-2 border-b border-stone-100 bg-stone-50 px-3 py-2">
      <label className="min-w-56 flex-1">
        <span className="mb-0.5 block text-[11px] text-stone-500">Dirección (https://, mailto: o una palabra como [URL_PLATAFORMA])</span>
        <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} className={`${CAMPO} bg-white`} />
      </label>
      <label className="min-w-40 flex-1">
        <span className="mb-0.5 block text-[11px] text-stone-500">Texto {comoBoton ? "del botón" : "(vacío: usa el texto seleccionado)"}</span>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} className={`${CAMPO} bg-white`} />
      </label>
      <label className="flex items-center gap-1.5 pb-2 text-xs text-stone-600">
        <input type="checkbox" checked={comoBoton} onChange={(e) => setComoBoton(e.target.checked)} /> Como botón
      </label>
      <div className="flex gap-1.5 pb-1">
        <button
          type="button"
          disabled={!valida || (comoBoton && !texto.trim())}
          onClick={() => {
            const u = url.trim();
            if (comoBoton) alInsertar(`<p style="margin:16px 0"><a href="${escapar(u)}" style="${ESTILO_BOTON_ENLACE}">${escapar(texto.trim())}</a></p>`, u);
            else if (texto.trim()) alInsertar(`<a href="${escapar(u)}" style="color:#038F67">${escapar(texto.trim())}</a>`, u);
            else alInsertar(null, u);
          }}
          className="rounded-md bg-cdmb-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
        >
          Insertar
        </button>
        <button type="button" onClick={alCerrar} className="rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function VentanaImagen({ alInsertar, alCerrar }: { alInsertar: (html: string) => void; alCerrar: () => void }) {
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [ancho, setAncho] = useState<string>("600");
  const [alineacion, setAlineacion] = useState<"left" | "center">("center");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const valida = /^https:\/\/[^\s"']+$/i.test(url.trim());

  async function alElegir(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!["image/png", "image/jpeg", "image/gif"].includes(file.type)) return setError("Use una imagen PNG, JPG o GIF (Outlook no muestra WebP ni SVG).");
    if (file.size > 2 * 1024 * 1024) return setError("La imagen no puede superar 2 MB.");
    setSubiendo(true);
    try {
      setUrl(await subirImagen(file));
      if (!alt) setAlt(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="space-y-2 border-b border-stone-100 bg-stone-50 px-3 py-2">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <span className="mb-0.5 block text-[11px] text-stone-500">Desde su equipo</span>
          <input ref={archivo} type="file" accept="image/png,image/jpeg,image/gif" className="sr-only" onChange={(e) => alElegir(e.target.files?.[0])} />
          <button
            type="button"
            disabled={subiendo}
            onClick={() => archivo.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
            {subiendo ? "Subiendo…" : "Subir imagen"}
          </button>
        </div>
        <label className="min-w-56 flex-1">
          <span className="mb-0.5 block text-[11px] text-stone-500">o dirección pública de la imagen (https://)</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/imagen.png" className={`${CAMPO} bg-white`} />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1">
          <span className="mb-0.5 block text-[11px] text-stone-500">Texto alternativo (se lee si el correo bloquea las imágenes)</span>
          <input value={alt} onChange={(e) => setAlt(e.target.value)} className={`${CAMPO} bg-white`} />
        </label>
        <label>
          <span className="mb-0.5 block text-[11px] text-stone-500">Tamaño</span>
          <select value={ancho} onChange={(e) => setAncho(e.target.value)} className={`${CAMPO} bg-white`}>
            {ANCHOS.map((a) => (
              <option key={a.id} value={a.id}>{a.etiqueta}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-0.5 block text-[11px] text-stone-500">Alineación</span>
          <select value={alineacion} onChange={(e) => setAlineacion(e.target.value as "left" | "center")} className={`${CAMPO} bg-white`}>
            <option value="center">Centrada</option>
            <option value="left">A la izquierda</option>
          </select>
        </label>
        <div className="flex gap-1.5 pb-1">
          <button
            type="button"
            disabled={!valida || subiendo}
            onClick={() => alInsertar(htmlImagen({ url: url.trim(), alt: alt.trim(), ancho, alineacion }))}
            className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
          >
            <SquareMousePointer className="h-3.5 w-3.5" aria-hidden /> Insertar
          </button>
          <button type="button" onClick={alCerrar} className="rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50">
            Cancelar
          </button>
        </div>
      </div>
      {valida && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url.trim()} alt="" className="max-h-20 rounded border border-stone-200 bg-white object-contain" />
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
