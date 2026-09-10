import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import bwipjs from "bwip-js/node";
import { denominacionParaFirma } from "@/lib/denominacion-empleo";

/**
 * Estampa sobre la primera página de un PDF el rótulo de radicación (número +
 * Code 128 + QR de verificación) y, si la comunicación está firmada, el sello de
 * firma electrónica al pie. El PDF original en Storage NO se toca (Ley 594/2000:
 * el documento se conserva como se recibió); esto genera una copia derivada para
 * descargar. `pdf-lib` y `bwip-js` son JS puro — corren en el runtime de Vercel.
 */

const VERDE = rgb(0.11, 0.478, 0.271); // ~ #1c7a45
const GRIS = rgb(0.35, 0.35, 0.35);
const GRIS_CLARO = rgb(0.5, 0.5, 0.5);

async function pngBarras(radicado: string): Promise<Buffer> {
  return bwipjs.toBuffer({ bcid: "code128", text: radicado, scale: 3, height: 9, includetext: false });
}

async function pngQr(url: string): Promise<Buffer> {
  return bwipjs.toBuffer({ bcid: "qrcode", text: url, scale: 4 });
}

export type DatosRotuloPdf = {
  radicado: string;
  tipoEtiqueta: string;
  fechaRadicacion: string;
  dependencia: string | null;
  folios: number;
  serieCodigo: string | null;
  baseUrl: string;
};

export type FirmaRotuloPdf = {
  nombre: string;
  denominacionEmpleo: string | null;
  denominacionComplemento: string | null;
  sexo: string | null;
  dependencia: string | null;
  fechaHora: string;
  hash: string;
};

export async function estamparRotulo(
  pdfBytes: Buffer | Uint8Array,
  datos: DatosRotuloPdf,
  firmas: FirmaRotuloPdf[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.getPages()[0];
  if (!page) return pdf.save();
  const { width, height } = page.getSize();

  const [barPngBytes, qrPngBytes] = await Promise.all([
    pngBarras(datos.radicado),
    pngQr(`${datos.baseUrl.replace(/\/+$/, "")}/verificar/${encodeURIComponent(datos.radicado)}`),
  ]);
  const bar = await pdf.embedPng(barPngBytes);
  const qr = await pdf.embedPng(qrPngBytes);

  // --- Rótulo, esquina superior derecha ---
  const boxW = 250;
  const boxH = 118;
  const x = Math.max(12, width - boxW - 20);
  const y = Math.max(12, height - boxH - 20);

  page.drawRectangle({ x, y, width: boxW, height: boxH, color: rgb(1, 1, 1), borderColor: VERDE, borderWidth: 1 });
  page.drawText(`RADICADO DE CORRESPONDENCIA · ${datos.tipoEtiqueta.toUpperCase()}`, {
    x: x + 8, y: y + boxH - 13, size: 5.5, font: fontBold, color: GRIS_CLARO,
  });
  page.drawText(datos.radicado, { x: x + 8, y: y + boxH - 30, size: 12, font: fontBold, color: VERDE });
  page.drawText(datos.fechaRadicacion, { x: x + 8, y: y + boxH - 41, size: 7, font, color: GRIS });

  // QR arriba a la derecha — sin solaparse con el código de barras de abajo.
  const qrSize = 44;
  page.drawImage(qr, { x: x + boxW - qrSize - 8, y: y + boxH - qrSize - 10, width: qrSize, height: qrSize });

  // Código de barras: franja completa bajo el texto.
  const barW = boxW - 16;
  page.drawImage(bar, { x: x + 8, y: y + 20, width: barW, height: 26 });

  const pie = [
    `Folios: ${datos.folios}`,
    datos.serieCodigo ? `TRD: ${datos.serieCodigo}` : null,
    datos.dependencia,
  ].filter(Boolean).join("  ·  ");
  page.drawText(pie.slice(0, 66), { x: x + 8, y: y + 8, size: 5.5, font, color: GRIS_CLARO });

  // --- Sello de firma electrónica, al pie (por líneas: nombre / cargo / oficina / fecha·hash) ---
  if (firmas.length > 0) {
    const lh = 7.4;
    const altoBloque = 4 * lh + 3;
    let cy = 18 + 12 + firmas.length * altoBloque + 8;
    page.drawLine({ start: { x: 24, y: cy }, end: { x: width - 24, y: cy }, thickness: 0.5, color: VERDE });
    cy -= 9;
    page.drawText("DOCUMENTO FIRMADO ELECTRÓNICAMENTE", { x: 24, y: cy, size: 6, font: fontBold, color: VERDE });
    cy -= 11;
    for (const f of firmas) {
      const cargo = denominacionParaFirma(f.denominacionEmpleo, f.sexo, f.denominacionComplemento);
      page.drawText(f.nombre.slice(0, 90), { x: 24, y: cy, size: 6.5, font: fontBold, color: GRIS }); cy -= lh;
      if (cargo) { page.drawText(cargo.slice(0, 100), { x: 24, y: cy, size: 6, font, color: GRIS }); cy -= lh; }
      if (f.dependencia) { page.drawText(f.dependencia.slice(0, 100), { x: 24, y: cy, size: 6, font, color: GRIS }); cy -= lh; }
      page.drawText(`${f.fechaHora}  ·  SHA-256 ${f.hash.slice(0, 16)}…`, { x: 24, y: cy, size: 5.5, font, color: GRIS_CLARO });
      cy -= lh + 3;
    }
    page.drawText("Firma electrónica · Ley 527 de 1999 · Decreto 1074 de 2015", { x: 24, y: cy, size: 5.5, font, color: GRIS_CLARO });
  }

  return pdf.save();
}
