import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import bwipjs from "bwip-js/node";
import { denominacionParaFirma } from "@/lib/denominacion-empleo";

/**
 * Expediente consolidado en UN solo PDF (opción de descarga, no de almacenamiento):
 * portada + índice electrónico y luego, en orden, cada documento del expediente. Las
 * comunicaciones enviadas (respuestas) van primero con su rótulo y su sello de
 * firma; después las recibidas (solicitudes) con sus adjuntos; al final los
 * documentos cargados directo. Los archivos que no son PDF ni imagen quedan como
 * una hoja de referencia (no se convierten — esa es la brecha conocida de PDF/A).
 *
 * El origen de verdad sigue siendo cada documento por separado, con su hash y su
 * lugar en el índice firmado; esto es una vista armada al vuelo, como el «con
 * rótulo» de un adjunto.
 */

const VERDE = rgb(0.11, 0.478, 0.271);
const GRIS = rgb(0.33, 0.33, 0.33);
const GRIS_CLARO = rgb(0.5, 0.5, 0.5);
const MARGEN = 48;

export type PiezaExpediente = {
  clase: "ENVIADA" | "RECIBIDA" | "INTERNA" | "DOCUMENTO";
  titulo: string; // ej. "CDMB-E-2026-000001 · Oficio de salida"
  subtitulo?: string | null; // asunto
  fecha?: string | null;
  radicado?: string | null; // para el rótulo (código de barras + QR)
  contenido?: string | null; // cuerpo del oficio/memorando, si aplica
  folios?: number | null;
  firmas?: {
    nombre: string;
    denominacionEmpleo: string | null;
    denominacionComplemento: string | null;
    sexo: string | null;
    dependencia: string | null;
    fechaHora: string;
    hash: string;
  }[];
  adjuntos: { nombre: string; mimeType: string; bytes: Buffer | Uint8Array | null }[];
};

export type DatosExpedientePdf = {
  numero: string;
  asunto: string;
  dependencia: string;
  serie: string | null;
  subserie: string | null;
  estado: string;
  fechaApertura: string;
  fechaCierre: string | null;
  indiceHash: string | null;
  totalFolios: number;
  baseUrl: string;
};

function envolver(texto: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split(/\r?\n/)) {
    let actual = "";
    for (const palabra of parrafo.split(/\s+/)) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(prueba, size) > maxWidth && actual) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = prueba;
      }
    }
    lineas.push(actual);
  }
  return lineas;
}

async function pngBarras(radicado: string): Promise<Buffer> {
  return bwipjs.toBuffer({ bcid: "code128", text: radicado, scale: 3, height: 9, includetext: false });
}
async function pngQr(url: string): Promise<Buffer> {
  return bwipjs.toBuffer({ bcid: "qrcode", text: url, scale: 4 });
}

function pieDePagina(page: PDFPage, font: PDFFont, texto: string) {
  page.drawText(texto.slice(0, 110), { x: MARGEN, y: 24, size: 7, font, color: GRIS_CLARO });
}

export async function generarExpedientePdf(datos: DatosExpedientePdf, piezas: PiezaExpediente[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let folio = 0;

  // --- Portada + índice ---
  const portada = pdf.addPage();
  const { width, height } = portada.getSize();
  const anchoUtil = width - MARGEN * 2;
  let y = height - MARGEN;

  portada.drawText("EXPEDIENTE ELECTRÓNICO DE ARCHIVO", { x: MARGEN, y, size: 9, font: fontBold, color: VERDE });
  y -= 22;
  portada.drawText(datos.numero, { x: MARGEN, y, size: 20, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  y -= 24;
  for (const linea of envolver(datos.asunto, font, 11, anchoUtil)) {
    portada.drawText(linea, { x: MARGEN, y, size: 11, font, color: GRIS });
    y -= 15;
  }
  y -= 8;
  const meta = [
    `Dependencia: ${datos.dependencia}`,
    datos.serie ? `Serie: ${datos.serie}` : null,
    datos.subserie ? `Subserie: ${datos.subserie}` : null,
    `Estado: ${datos.estado}`,
    `Apertura: ${datos.fechaApertura}`,
    datos.fechaCierre ? `Cierre: ${datos.fechaCierre}` : null,
    `Folios: ${datos.totalFolios}`,
    datos.indiceHash ? `Índice firmado SHA-256: ${datos.indiceHash.slice(0, 32)}…` : null,
  ].filter(Boolean) as string[];
  for (const m of meta) {
    portada.drawText(m, { x: MARGEN, y, size: 9, font, color: GRIS_CLARO });
    y -= 13;
  }

  y -= 14;
  portada.drawText("ÍNDICE", { x: MARGEN, y, size: 9, font: fontBold, color: VERDE });
  y -= 16;
  piezas.forEach((p, i) => {
    if (y < MARGEN + 40) return; // el índice ocupa una página; el detalle sigue igual
    portada.drawText(`${String(i + 1).padStart(2, "0")}.`, { x: MARGEN, y, size: 9, font, color: GRIS_CLARO });
    portada.drawText(p.titulo.slice(0, 70), { x: MARGEN + 24, y, size: 9, font, color: GRIS });
    if (p.subtitulo) {
      portada.drawText(envolver(p.subtitulo, font, 8, anchoUtil - 24)[0]!.slice(0, 90), {
        x: MARGEN + 24, y: y - 10, size: 8, font, color: GRIS_CLARO,
      });
      y -= 22;
    } else {
      y -= 14;
    }
  });
  pieDePagina(portada, font, `${datos.numero} · Expediente consolidado · generado ${new Date().toLocaleString("es-CO")}`);

  // --- Cada pieza ---
  for (const pieza of piezas) {
    // Separador / carátula de la pieza
    const sep = pdf.addPage();
    const sw = sep.getSize().width;
    let sy = sep.getSize().height - MARGEN;
    sep.drawLine({ start: { x: MARGEN, y: sy }, end: { x: sw - MARGEN, y: sy }, thickness: 1.5, color: VERDE });
    sy -= 22;
    sep.drawText(pieza.titulo, { x: MARGEN, y: sy, size: 14, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    sy -= 20;
    if (pieza.subtitulo) {
      for (const l of envolver(pieza.subtitulo, font, 10, sw - MARGEN * 2)) {
        sep.drawText(l, { x: MARGEN, y: sy, size: 10, font, color: GRIS });
        sy -= 13;
      }
    }
    if (pieza.fecha) {
      sep.drawText(pieza.fecha, { x: MARGEN, y: sy, size: 9, font, color: GRIS_CLARO });
      sy -= 16;
    }

    // Rótulo (código de barras + QR) si tiene radicado
    if (pieza.radicado) {
      try {
        const [bar, qr] = await Promise.all([
          pngBarras(pieza.radicado),
          pngQr(`${datos.baseUrl.replace(/\/+$/, "")}/verificar/${encodeURIComponent(pieza.radicado)}`),
        ]);
        const barImg = await pdf.embedPng(bar);
        const qrImg = await pdf.embedPng(qr);
        sy -= 8;
        sep.drawImage(barImg, { x: MARGEN, y: sy - 26, width: 180, height: 26 });
        sep.drawImage(qrImg, { x: MARGEN + 200, y: sy - 44, width: 44, height: 44 });
        sy -= 52;
      } catch {
        /* si bwip falla, la pieza sigue sin rótulo */
      }
    }

    // Cuerpo del oficio/memorando (si aplica y no viene como PDF)
    const soloTexto = pieza.contenido && !pieza.adjuntos.some((a) => a.mimeType === "application/pdf" && a.bytes);
    if (soloTexto && pieza.contenido) {
      sy -= 10;
      for (const l of envolver(pieza.contenido, font, 10, sw - MARGEN * 2)) {
        if (sy < MARGEN + 60) break;
        sep.drawText(l, { x: MARGEN, y: sy, size: 10, font, color: GRIS });
        sy -= 13;
      }
    }

    // Sello de firma
    if (pieza.firmas && pieza.firmas.length > 0) {
      sy = Math.min(sy, MARGEN + 20 + pieza.firmas.length * 30);
      sep.drawLine({ start: { x: MARGEN, y: sy }, end: { x: sw - MARGEN, y: sy }, thickness: 0.5, color: VERDE });
      sy -= 11;
      sep.drawText("DOCUMENTO FIRMADO ELECTRÓNICAMENTE", { x: MARGEN, y: sy, size: 7, font: fontBold, color: VERDE });
      sy -= 12;
      for (const f of pieza.firmas) {
        const cargo = denominacionParaFirma(f.denominacionEmpleo, f.sexo, f.denominacionComplemento);
        sep.drawText(f.nombre.slice(0, 90), { x: MARGEN, y: sy, size: 8, font: fontBold, color: GRIS }); sy -= 10;
        if (cargo) { sep.drawText(cargo.slice(0, 100), { x: MARGEN, y: sy, size: 7.5, font, color: GRIS }); sy -= 10; }
        if (f.dependencia) { sep.drawText(f.dependencia.slice(0, 100), { x: MARGEN, y: sy, size: 7.5, font, color: GRIS }); sy -= 10; }
        sep.drawText(`${f.fechaHora}  ·  SHA-256 ${f.hash.slice(0, 16)}…`, { x: MARGEN, y: sy, size: 6.5, font, color: GRIS_CLARO }); sy -= 13;
      }
      sep.drawText("Firma electrónica · Ley 527 de 1999 · Decreto 1074 de 2015", { x: MARGEN, y: sy, size: 6.5, font, color: GRIS_CLARO });
    }

    folio += 1;
    pieDePagina(sep, font, `${datos.numero} · ${pieza.titulo} · folio ${folio}`);

    // Adjuntos
    for (const adj of pieza.adjuntos) {
      if (!adj.bytes) continue;
      if (adj.mimeType === "application/pdf") {
        try {
          const src = await PDFDocument.load(adj.bytes, { ignoreEncryption: true });
          const paginas = await pdf.copyPages(src, src.getPageIndices());
          for (const p of paginas) {
            pdf.addPage(p);
            folio += 1;
            pieDePagina(p, font, `${datos.numero} · ${adj.nombre} · folio ${folio}`);
          }
        } catch {
          const err = pdf.addPage();
          err.drawText(`No se pudo incrustar "${adj.nombre}" (PDF ilegible). Disponible por separado en el índice electrónico.`, {
            x: MARGEN, y: err.getSize().height - MARGEN - 20, size: 10, font, color: GRIS,
          });
          folio += 1;
        }
      } else if (adj.mimeType === "image/png" || adj.mimeType === "image/jpeg") {
        try {
          const img = adj.mimeType === "image/png" ? await pdf.embedPng(adj.bytes) : await pdf.embedJpg(adj.bytes);
          const pg = pdf.addPage();
          const { width: pw, height: ph } = pg.getSize();
          const esc = Math.min((pw - MARGEN * 2) / img.width, (ph - MARGEN * 2 - 20) / img.height, 1);
          pg.drawImage(img, { x: (pw - img.width * esc) / 2, y: (ph - img.height * esc) / 2, width: img.width * esc, height: img.height * esc });
          folio += 1;
          pieDePagina(pg, font, `${datos.numero} · ${adj.nombre} · folio ${folio}`);
        } catch {
          /* imagen ilegible — se omite */
        }
      } else {
        const pg = pdf.addPage();
        pg.drawText(`Documento: ${adj.nombre}`, { x: MARGEN, y: pg.getSize().height - MARGEN - 20, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        pg.drawText(`Tipo ${adj.mimeType}. No se incluye en el PDF consolidado (no es PDF ni imagen);`, {
          x: MARGEN, y: pg.getSize().height - MARGEN - 40, size: 9, font, color: GRIS,
        });
        pg.drawText("disponible por separado en el índice electrónico del expediente.", {
          x: MARGEN, y: pg.getSize().height - MARGEN - 53, size: 9, font, color: GRIS,
        });
        folio += 1;
        pieDePagina(pg, font, `${datos.numero} · ${adj.nombre} · folio ${folio}`);
      }
    }
  }

  return pdf.save();
}
