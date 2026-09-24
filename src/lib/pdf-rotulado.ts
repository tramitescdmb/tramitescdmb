import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import bwipjs from "bwip-js/node";
import { denominacionParaFirma } from "@/lib/denominacion-empleo";
import { ordenarPorCalidad, rotuloCalidadFirma } from "@/lib/calidad-firma";

const VERDE = rgb(0.11, 0.478, 0.271);
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
  cedulaONit: string | null;
  denominacionEmpleo: string | null;
  denominacionComplemento: string | null;
  sexo: string | null;
  dependencia: string | null;
  fechaHora: string;
  hash: string;
  calidad?: string | null;
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

  const qrSize = 44;
  page.drawImage(qr, { x: x + boxW - qrSize - 8, y: y + boxH - qrSize - 10, width: qrSize, height: qrSize });

  const barW = boxW - 16;
  page.drawImage(bar, { x: x + 8, y: y + 20, width: barW, height: 26 });

  const pie = [
    `Folios: ${datos.folios}`,
    datos.serieCodigo ? `TRD: ${datos.serieCodigo}` : null,
    datos.dependencia,
  ].filter(Boolean).join("  ·  ");
  page.drawText(pie.slice(0, 66), { x: x + 8, y: y + 8, size: 5.5, font, color: GRIS_CLARO });

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
      const nombreLinea = f.cedulaONit ? `${f.nombre} — C.C./NIT ${f.cedulaONit}` : f.nombre;
      page.drawText(nombreLinea.slice(0, 100), { x: 24, y: cy, size: 6.5, font: fontBold, color: GRIS }); cy -= lh;
      if (cargo) { page.drawText(cargo.slice(0, 100), { x: 24, y: cy, size: 6, font, color: GRIS }); cy -= lh; }
      if (f.dependencia) { page.drawText(f.dependencia.slice(0, 100), { x: 24, y: cy, size: 6, font, color: GRIS }); cy -= lh; }
      page.drawText(`${f.fechaHora}  ·  SHA-256 ${f.hash.slice(0, 16)}…`, { x: 24, y: cy, size: 5.5, font, color: GRIS_CLARO });
      cy -= lh + 3;
    }
    page.drawText("Firma electrónica · Ley 527 de 1999 · Decreto 1074 de 2015", { x: 24, y: cy, size: 5.5, font, color: GRIS_CLARO });
  }

  return pdf.save();
}

export type DatosFirmaSigec = {
  numeroExpediente: string;
  baseUrl: string;
};

export type DatosFirmaTramite = DatosFirmaSigec;

async function estamparFirmasExpediente(
  pdfBytes: Buffer | Uint8Array,
  datos: DatosFirmaSigec,
  firmasSinOrden: FirmaRotuloPdf[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  if (firmasSinOrden.length === 0) return pdf.save();
  const firmas = ordenarPorCalidad(firmasSinOrden, (f) => f.calidad);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.getPages()[0];
  if (!page) return pdf.save();
  const { width, height } = page.getSize();

  const qrPngBytes = await pngQr(`${datos.baseUrl.replace(/\/+$/, "")}/verificar/${encodeURIComponent(datos.numeroExpediente)}`);
  const qr = await pdf.embedPng(qrPngBytes);

  const qrSize = 49;
  const qx = Math.max(12, width - qrSize - 20);
  const qy = Math.max(12, height - qrSize - 20);
  page.drawImage(qr, { x: qx, y: qy, width: qrSize, height: qrSize });
  page.drawText("Verifique esta firma", { x: qx, y: qy - 9, size: 5.5, font, color: GRIS_CLARO });

  const tamanos = (f: FirmaRotuloPdf) =>
    rotuloCalidadFirma(f.calidad) ? { nombre: 5.6, linea: 5.2, meta: 4.8, lh: 6.4 } : { nombre: 6.5, linea: 6, meta: 5.5, lh: 7.4 };
  const altoTotal = firmas.reduce((acc, f) => acc + 6 * tamanos(f).lh + 3, 0);
  let cy = 18 + 12 + altoTotal + 8;
  page.drawLine({ start: { x: 24, y: cy }, end: { x: width - 24, y: cy }, thickness: 0.5, color: VERDE });
  cy -= 9;
  page.drawText("DOCUMENTO FIRMADO ELECTRÓNICAMENTE", { x: 24, y: cy, size: 6, font: fontBold, color: VERDE });
  cy -= 11;
  for (const f of firmas) {
    const t = tamanos(f);
    const cargo = denominacionParaFirma(f.denominacionEmpleo, f.sexo, f.denominacionComplemento);
    const rotulo = rotuloCalidadFirma(f.calidad);
    if (rotulo) {
      const etiqueta = `${rotulo}: `;
      page.drawText(etiqueta, { x: 24, y: cy, size: t.nombre, font: fontBold, color: VERDE });
      page.drawText(f.nombre.slice(0, 90), { x: 24 + fontBold.widthOfTextAtSize(etiqueta, t.nombre), y: cy, size: t.nombre, font: fontBold, color: GRIS });
    } else {
      page.drawText(f.nombre.slice(0, 100), { x: 24, y: cy, size: t.nombre, font: fontBold, color: GRIS });
    }
    cy -= t.lh;
    if (f.cedulaONit) {
      page.drawText(`C.C./NIT ${f.cedulaONit}`, { x: 24, y: cy, size: t.linea, font, color: GRIS });
      cy -= t.lh;
    }
    if (cargo) {
      page.drawText(cargo.slice(0, 100), { x: 24, y: cy, size: t.linea, font, color: GRIS });
      cy -= t.lh;
    }
    if (f.dependencia) {
      page.drawText(f.dependencia.slice(0, 100), { x: 24, y: cy, size: t.linea, font, color: GRIS });
      cy -= t.lh;
    }
    page.drawText(f.fechaHora, { x: 24, y: cy, size: t.meta, font, color: GRIS_CLARO });
    cy -= t.lh;
    page.drawText(`SHA-256: ${f.hash}`, { x: 24, y: cy, size: t.meta, font, color: GRIS_CLARO });
    cy -= t.lh + 3;
  }
  page.drawText("Firma electrónica · Ley 527 de 1999 · Decreto 1074 de 2015", { x: 24, y: cy, size: 5.5, font, color: GRIS_CLARO });

  return pdf.save();
}

export function estamparFirmaSigec(pdfBytes: Buffer | Uint8Array, datos: DatosFirmaSigec, firmas: FirmaRotuloPdf[]): Promise<Uint8Array> {
  return estamparFirmasExpediente(pdfBytes, datos, firmas);
}

export function estamparFirmaTramite(pdfBytes: Buffer | Uint8Array, datos: DatosFirmaTramite, firmas: FirmaRotuloPdf[]): Promise<Uint8Array> {
  return estamparFirmasExpediente(pdfBytes, datos, firmas);
}
