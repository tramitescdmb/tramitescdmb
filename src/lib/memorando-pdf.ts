import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { bloquesCuerpo, type SegmentoTexto } from "@/lib/memorandos-formato";
import type { DatosDocumentoMemorando, FirmaMemorandoDoc } from "@/components/memorandos/DocumentoMemorando";

/**
 * PDF del memorando con texto vectorial (no una foto de la pantalla): se lee nítido a cualquier zoom,
 * se puede seleccionar y buscar, y pesa poco. Sigue el modelo ADEI – 054 /2026: hoja carta, sin
 * encabezado de logo ni nombre de la entidad, MEMORANDO centrado, número, ciudad y fecha, PARA / DE,
 * asunto, cuerpo (párrafos justificados, negrillas y tablas), recuadro de firma con sus metadatos,
 * cuadro Proyectó / Revisó / Oficina responsable y los datos del documento para verificarlo.
 */

const ANCHO = 612; // carta
const ALTO = 792;
const IZQ = 72;
const DER = 66;
const ARRIBA = 72;
const ABAJO = 64;
const UTIL = ANCHO - IZQ - DER;
const SANGRIA = 76; // columna del texto de PARA, DE y Asunto

const NEGRO = rgb(0, 0, 0);
const GRIS = rgb(0.35, 0.35, 0.35);
const VERDE = rgb(0.05, 0.38, 0.25);
const BORDE = rgb(0.3, 0.3, 0.3);

type Fuentes = { normal: PDFFont; negrilla: PDFFont };
type Ficha = { texto: string; negrilla: boolean; espacioAntes: boolean };
type Linea = Ficha[];

/** Deja solo caracteres que las fuentes estándar del PDF (WinAnsi) pueden escribir. */
export function textoSeguro(texto: string, font: PDFFont): string {
  const limpio = (texto ?? "").replace(/[   \t]/g, " ").replace(/[​-‍﻿]/g, "");
  let out = "";
  for (const ch of limpio) {
    if (ch === "\n" || ch === "\r") {
      out += " ";
      continue;
    }
    try {
      font.widthOfTextAtSize(ch, 10);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

function fichas(segmentos: SegmentoTexto[], f: Fuentes): Ficha[] {
  const out: Ficha[] = [];
  let espacio = false;
  for (const s of segmentos) {
    const fuente = s.negrilla ? f.negrilla : f.normal;
    const texto = textoSeguro(s.texto, fuente);
    for (const m of texto.matchAll(/(\s+)|([^\s]+)/g)) {
      if (m[1]) espacio = true;
      else {
        out.push({ texto: m[2]!, negrilla: s.negrilla, espacioAntes: espacio && out.length > 0 });
        espacio = false;
      }
    }
  }
  return out;
}

function anchoFicha(x: Ficha, f: Fuentes, size: number) {
  return (x.negrilla ? f.negrilla : f.normal).widthOfTextAtSize(x.texto, size);
}

/** Corta una palabra más ancha que el renglón (p. ej. una huella SHA-256 o una URL). */
function partirPalabra(x: Ficha, max: number, f: Fuentes, size: number): Ficha[] {
  const fuente = x.negrilla ? f.negrilla : f.normal;
  const partes: Ficha[] = [];
  let actual = "";
  for (const ch of x.texto) {
    if (actual && fuente.widthOfTextAtSize(actual + ch, size) > max) {
      partes.push({ texto: actual, negrilla: x.negrilla, espacioAntes: partes.length === 0 ? x.espacioAntes : false });
      actual = "";
    }
    actual += ch;
  }
  if (actual) partes.push({ texto: actual, negrilla: x.negrilla, espacioAntes: partes.length === 0 ? x.espacioAntes : false });
  return partes;
}

export function partirEnLineas(segmentos: SegmentoTexto[], max: number, f: Fuentes, size: number): Linea[] {
  const espacio = f.normal.widthOfTextAtSize(" ", size);
  const lineas: Linea[] = [];
  let linea: Linea = [];
  let ancho = 0;
  const lista = fichas(segmentos, f).flatMap((x) => (anchoFicha(x, f, size) > max ? partirPalabra(x, max, f, size) : [x]));
  for (const x of lista) {
    const w = anchoFicha(x, f, size);
    const sep = linea.length && x.espacioAntes ? espacio : 0;
    if (linea.length && ancho + sep + w > max) {
      lineas.push(linea);
      linea = [{ ...x, espacioAntes: false }];
      ancho = w;
    } else {
      linea.push(linea.length ? x : { ...x, espacioAntes: false });
      ancho += sep + w;
    }
  }
  if (linea.length) lineas.push(linea);
  return lineas;
}

const seg = (texto: string, negrilla = false): SegmentoTexto[] => [{ texto, negrilla }];

class Lienzo {
  pdf: PDFDocument;
  f: Fuentes;
  page!: PDFPage;
  y = 0;
  constructor(pdf: PDFDocument, f: Fuentes) {
    this.pdf = pdf;
    this.f = f;
    this.nuevaPagina();
  }
  nuevaPagina() {
    this.page = this.pdf.addPage([ANCHO, ALTO]);
    this.y = ALTO - ARRIBA;
  }
  /** Garantiza alto disponible; si no cabe, pasa a la página siguiente. Devuelve true si cambió de página. */
  asegurar(alto: number): boolean {
    if (this.y - alto < ABAJO) {
      this.nuevaPagina();
      return true;
    }
    return false;
  }
  espacio(alto: number) {
    this.y -= alto;
  }
  /** Dibuja un renglón ya partido. `y` es la línea base. */
  dibujarLinea(linea: Linea, x: number, y: number, size: number, opciones: { justificar?: number; centrar?: number; color?: RGB } = {}) {
    const espacio = this.f.normal.widthOfTextAtSize(" ", size);
    const natural = linea.reduce((a, t, i) => a + anchoFicha(t, this.f, size) + (i > 0 && t.espacioAntes ? espacio : 0), 0);
    const huecos = linea.filter((t, i) => i > 0 && t.espacioAntes).length;
    const extra = opciones.justificar && huecos > 0 ? Math.max(0, (opciones.justificar - natural) / huecos) : 0;
    let cx = opciones.centrar ? x + Math.max(0, (opciones.centrar - natural) / 2) : x;
    linea.forEach((t, i) => {
      if (i > 0 && t.espacioAntes) cx += espacio + extra;
      const font = t.negrilla ? this.f.negrilla : this.f.normal;
      this.page.drawText(t.texto, { x: cx, y, size, font, color: opciones.color ?? NEGRO });
      cx += font.widthOfTextAtSize(t.texto, size);
    });
  }
  /** Párrafo que puede cortarse entre páginas, renglón por renglón. */
  parrafo(segmentos: SegmentoTexto[], opciones: { x?: number; ancho?: number; size?: number; interlinea?: number; justificar?: boolean; centrar?: boolean; color?: RGB } = {}) {
    const x = opciones.x ?? IZQ;
    const ancho = opciones.ancho ?? UTIL;
    const size = opciones.size ?? 11;
    const lh = opciones.interlinea ?? size * 1.3;
    const lineas = partirEnLineas(segmentos, ancho, this.f, size);
    lineas.forEach((l, i) => {
      this.asegurar(lh);
      this.y -= lh;
      const ultima = i === lineas.length - 1;
      this.dibujarLinea(l, x, this.y + (lh - size) / 2 + 1, size, {
        justificar: opciones.justificar && !ultima ? ancho : undefined,
        centrar: opciones.centrar ? ancho : undefined,
        color: opciones.color,
      });
    });
  }
  /** Alto de un párrafo sin dibujarlo (para mantener bloques juntos). */
  altoParrafo(segmentos: SegmentoTexto[], ancho: number, size: number, interlinea = size * 1.3) {
    return partirEnLineas(segmentos, ancho, this.f, size).length * interlinea;
  }
}

type Celda = { segmentos: SegmentoTexto[]; size?: number; centrar?: boolean; color?: RGB; colSpan?: number };

/** Tabla con bordes. Cada fila se mantiene entera; si no cabe, pasa de página (y repite el encabezado). */
function tabla(l: Lienzo, filas: Celda[][], anchos: number[], opciones: { size: number; encabezado?: boolean; padding?: number }) {
  const pad = opciones.padding ?? 3;
  const lhDe = (size: number) => size * 1.25;
  const medir = (fila: Celda[]) => {
    let col = 0;
    let alto = 0;
    const celdas = fila.map((c) => {
      const span = c.colSpan ?? 1;
      const ancho = anchos.slice(col, col + span).reduce((a, b) => a + b, 0);
      const x = IZQ + anchos.slice(0, col).reduce((a, b) => a + b, 0);
      col += span;
      const size = c.size ?? opciones.size;
      const lineas = partirEnLineas(c.segmentos, ancho - pad * 2, l.f, size);
      alto = Math.max(alto, lineas.length * lhDe(size) + pad * 2);
      return { c, x, ancho, size, lineas };
    });
    return { celdas, alto };
  };
  const dibujar = (fila: Celda[]) => {
    const { celdas, alto } = medir(fila);
    const tope = l.y;
    for (const { c, x, ancho, size, lineas } of celdas) {
      l.page.drawRectangle({ x, y: tope - alto, width: ancho, height: alto, borderColor: BORDE, borderWidth: 0.5 });
      lineas.forEach((ln, i) => {
        const base = tope - pad - (i + 1) * lhDe(size) + (lhDe(size) - size) / 2 + 1;
        l.dibujarLinea(ln, x + pad, base, size, { centrar: c.centrar ? ancho - pad * 2 : undefined, color: c.color });
      });
    }
    l.y -= alto;
  };
  const encabezado = opciones.encabezado ? filas[0] : null;
  filas.forEach((fila, i) => {
    const { alto } = medir(fila);
    if (l.asegurar(alto) && encabezado && i > 0) {
      dibujar(encabezado);
    }
    dibujar(fila);
  });
}

/** Anchos de columna de una tabla del cuerpo: según su contenido, ocupando todo el ancho útil. */
export function anchosColumnas(filas: SegmentoTexto[][][], f: Fuentes, size: number, total = UTIL, pad = 3): number[] {
  const n = Math.max(...filas.map((r) => r.length));
  const minimo = Array(n).fill(24) as number[];
  const natural = Array(n).fill(24) as number[];
  for (const fila of filas) {
    fila.forEach((celda, j) => {
      const xs = fichas(celda, f);
      const palabras = xs.map((x) => anchoFicha(x, f, size));
      const espacio = f.normal.widthOfTextAtSize(" ", size);
      const linea = palabras.reduce((a, w) => a + w, 0) + Math.max(0, xs.length - 1) * espacio;
      minimo[j] = Math.max(minimo[j]!, Math.min(Math.max(0, ...palabras), total / 3) + pad * 2 + 1);
      natural[j] = Math.max(natural[j]!, linea + pad * 2 + 1);
    });
  }
  const sumaMin = minimo.reduce((a, b) => a + b, 0);
  if (sumaMin >= total) return minimo.map((w) => (w * total) / sumaMin);
  const holgura = natural.map((w, j) => Math.max(0, w - minimo[j]!));
  const sumaHolgura = holgura.reduce((a, b) => a + b, 0);
  const libre = total - sumaMin;
  if (sumaHolgura >= libre) return minimo.map((w, j) => w + (holgura[j]! * libre) / sumaHolgura);
  // Todo cabe en una línea: el sobrante se reparte en proporción al contenido.
  const sobrante = libre - sumaHolgura;
  const sumaNat = natural.reduce((a, b) => a + b, 0);
  return natural.map((w) => w + (w * sobrante) / sumaNat);
}

function lineasFirma(fi: FirmaMemorandoDoc): { etiqueta: string; valor: string }[] {
  const out: { etiqueta: string; valor: string }[] = [];
  if (fi.nombre) out.push({ etiqueta: "Firmante", valor: `${fi.nombre}${fi.cargo ? ` — ${fi.cargo}` : ""}${fi.calidad ? ` (${fi.calidad})` : ""}` });
  out.push({ etiqueta: "Fecha y hora", valor: `${fi.fecha} (hora de Colombia)` });
  if (fi.id) out.push({ etiqueta: "Código de la firma", valor: fi.id });
  out.push({ etiqueta: "Huella SHA-256", valor: fi.hash });
  if (fi.formato) out.push({ etiqueta: "Mecanismo", valor: fi.formato });
  if (fi.sello) out.push({ etiqueta: "Sello de tiempo", valor: fi.sello });
  return out;
}

function recuadroFirma(l: Lienzo, fi: FirmaMemorandoDoc, ancho: number) {
  const size = 7.5;
  const lh = 9.4;
  const pad = 5;
  const filas = lineasFirma(fi).map((r) => [{ texto: `${r.etiqueta}: `, negrilla: false }, { texto: r.valor, negrilla: false }]);
  const lineas = filas.map((f) => partirEnLineas(f, ancho - pad * 2, l.f, size));
  const alto = pad * 2 + 11 + lineas.reduce((a, ls) => a + ls.length * lh, 0);
  const tope = l.y;
  l.page.drawRectangle({ x: IZQ, y: tope - alto, width: ancho, height: alto, borderColor: VERDE, borderWidth: 0.8 });
  l.page.drawText("FIRMADO ELECTRÓNICAMENTE", { x: IZQ + pad, y: tope - pad - 8, size: 8.5, font: l.f.negrilla, color: VERDE });
  let y = tope - pad - 11;
  for (const ls of lineas) {
    for (const ln of ls) {
      y -= lh;
      l.dibujarLinea(ln, IZQ + pad, y + 2, size, { color: rgb(0.15, 0.15, 0.15) });
    }
  }
  l.y -= alto;
  return alto;
}

function altoRecuadroFirma(l: Lienzo, fi: FirmaMemorandoDoc, ancho: number) {
  const filas = lineasFirma(fi).map((r) => seg(`${r.etiqueta}: ${r.valor}`));
  return 10 + 11 + filas.reduce((a, f) => a + partirEnLineas(f, ancho - 10, l.f, 7.5).length * 9.4, 0);
}

function celdaFirmaResponsable(fi: FirmaMemorandoDoc | null | undefined, estado: string | null | undefined): Celda {
  if (!fi) return { segmentos: seg(estado ?? "Pendiente de firma"), size: 7, color: GRIS };
  return {
    size: 6.8,
    segmentos: [
      { texto: "Firmado electrónicamente ", negrilla: true },
      { texto: `${fi.fecha} · Código ${fi.id ?? "—"} · SHA-256 ${fi.hash.slice(0, 24)}…`, negrilla: false },
    ],
  };
}

export async function memorandoAPdf(d: DatosDocumentoMemorando, titulo: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo);
  pdf.setSubject(d.asunto);
  pdf.setCreator("SIC CDMB");
  pdf.setProducer("SIC CDMB");
  pdf.setLanguage("es-CO");
  const f: Fuentes = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrilla: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const l = new Lienzo(pdf, f);
  const s = (t: string) => textoSeguro(t, f.normal);

  l.parrafo(seg("MEMORANDO", true), { centrar: true });
  l.espacio(24);
  l.parrafo(seg(d.numero ?? "____ – ___ /____"));
  l.espacio(8);
  l.parrafo(seg(`${d.ciudad}, ${d.fecha}`));
  l.espacio(26);

  const persona = (etiqueta: string, p: DatosDocumentoMemorando["para"], mayusculas: boolean) => {
    const nombre = p ? (mayusculas ? p.nombre.toUpperCase() : p.nombre) : "—";
    const alto = l.altoParrafo(seg(nombre, true), UTIL - SANGRIA, 11) + (p?.cargo ? l.altoParrafo(seg(p.cargo), UTIL - SANGRIA, 11) : 0);
    l.asegurar(alto);
    const tope = l.y;
    l.page.drawText(s(etiqueta), { x: IZQ, y: tope - 11.65, size: 11, font: f.normal });
    l.parrafo(seg(nombre, true), { x: IZQ + SANGRIA, ancho: UTIL - SANGRIA });
    if (p?.cargo) l.parrafo(seg(p.cargo), { x: IZQ + SANGRIA, ancho: UTIL - SANGRIA });
  };
  persona("PARA:", d.para, true);
  l.espacio(12);
  persona("DE:", d.de, false);
  l.espacio(22);

  {
    const asunto = (d.asunto || "—").toUpperCase();
    l.asegurar(15);
    const tope = l.y;
    l.page.drawText("Asunto:", { x: IZQ, y: tope - 11.65, size: 11, font: f.normal });
    l.parrafo(seg(asunto, true), { x: IZQ + SANGRIA, ancho: UTIL - SANGRIA });
  }
  l.espacio(20);

  for (const b of bloquesCuerpo(d.cuerpo)) {
    if (b.tipo === "parrafo") {
      // Cada renglón escrito es su propia línea (como en pantalla); el último de cada uno no se justifica.
      for (const linea of b.lineas) l.parrafo(linea, { justificar: true });
    } else {
      const size = 9.5;
      const anchos = anchosColumnas(b.filas, f, size);
      const n = anchos.length;
      const filas: Celda[][] = b.filas.map((fila, j) =>
        Array.from({ length: n }, (_, k) => {
          const c = fila[k] ?? [];
          return j === 0 ? { segmentos: c.map((x) => ({ ...x, negrilla: true })), centrar: true } : { segmentos: c };
        })
      );
      tabla(l, filas, anchos, { size, encabezado: b.filas.length > 1 });
    }
    l.espacio(10);
  }

  // Firma de quien envía: recuadro con metadatos + nombre y cargo, siempre juntos en la misma página.
  l.espacio(16);
  const anchoRecuadro = Math.min(UTIL, 330);
  const altoNombre = 14 + (d.de?.cargo ? 14 : 0);
  if (d.firma) {
    l.asegurar(altoRecuadroFirma(l, d.firma, anchoRecuadro) + 6 + altoNombre);
    recuadroFirma(l, d.firma, anchoRecuadro);
    l.espacio(6);
  } else {
    l.asegurar(30 + altoNombre);
    l.parrafo(seg("(Firma electrónica al enviar)"), { size: 8, color: GRIS });
    l.espacio(12);
  }
  l.parrafo(seg((d.de?.nombre ?? "").toUpperCase(), true));
  if (d.de?.cargo) l.parrafo(seg(d.de.cargo));
  l.espacio(14);

  // Cuadro de responsables (4 columnas como el modelo: rol, nombre, cargo, firma).
  {
    const anchos = [0.18, 0.24, 0.24, 0.34].map((p) => p * UTIL);
    const filas: Celda[][] = [];
    if (d.proyecto) filas.push([{ segmentos: seg("Proyectó:") }, { segmentos: seg(d.proyecto.nombre) }, { segmentos: seg(d.proyecto.cargo) }, celdaFirmaResponsable(d.firmaProyecto, d.estadoProyecto)]);
    if (d.reviso) filas.push([{ segmentos: seg("Revisó:") }, { segmentos: seg(d.reviso.nombre) }, { segmentos: seg(d.reviso.cargo) }, celdaFirmaResponsable(d.firmaReviso, d.estadoReviso)]);
    filas.push([{ segmentos: seg("Oficina responsable:") }, { segmentos: seg(d.oficina), colSpan: 3 }]);
    tabla(l, filas, anchos, { size: 7.8 });
  }

  if (d.verificacion) {
    l.espacio(12);
    const firmas = [d.firma, d.firmaProyecto, d.firmaReviso].filter(Boolean).length;
    const datos: SegmentoTexto[] = [
      { texto: "Radicado ", negrilla: false },
      { texto: d.verificacion.radicado, negrilla: true },
      { texto: `${d.numero ? ` · Memorando ${d.numero}` : ""}${d.verificacion.radicadoEn ? ` · Radicado el ${d.verificacion.radicadoEn}` : ""} · ${firmas} firma(s) electrónica(s).`, negrilla: false },
    ];
    const legal = seg(
      `Documento firmado electrónicamente conforme al artículo 7 de la Ley 527 de 1999 y al Decreto 1074 de 2015. Verifique su autenticidad en ${d.verificacion.url} con el código de cada firma.`
    );
    l.asegurar(10 + l.altoParrafo(datos, UTIL, 7.5, 9.4) + l.altoParrafo(legal, UTIL, 7.5, 9.4) + 10);
    l.page.drawLine({ start: { x: IZQ, y: l.y }, end: { x: IZQ + UTIL, y: l.y }, thickness: 0.5, color: GRIS });
    l.espacio(2);
    l.parrafo(seg("DATOS DEL DOCUMENTO", true), { size: 7.5, interlinea: 10 });
    l.parrafo(datos, { size: 7.5, interlinea: 9.4 });
    l.parrafo(legal, { size: 7.5, interlinea: 9.4, color: GRIS });
  }

  const paginas = pdf.getPages();
  const referencia = s([d.numero ? `Memorando ${d.numero}` : null, d.verificacion?.radicado ? `Radicado ${d.verificacion.radicado}` : null].filter(Boolean).join(" · "));
  paginas.forEach((p, i) => {
    const pie = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(pie, { x: ANCHO - DER - f.normal.widthOfTextAtSize(pie, 8), y: ABAJO / 2, size: 8, font: f.normal, color: GRIS });
    if (referencia) p.drawText(referencia, { x: IZQ, y: ABAJO / 2, size: 8, font: f.normal, color: GRIS });
  });
  return pdf.save();
}
