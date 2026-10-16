import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import bwipjs from "bwip-js/node";
import { denominacionParaFirma } from "@/lib/denominacion-empleo";
import { ordenarPorCalidad, nivelSello, etiquetaCalidadCompleta } from "@/lib/calidad-firma";
import { textoIdentificacionFirma } from "@/lib/identificacion-firma";
import { limpiarCadenasPdf } from "@/lib/caracteres-pdf";

const VERDE = rgb(0.012, 0.561, 0.404);
const GRIS = rgb(0.35, 0.35, 0.35);
const GRIS_CLARO = rgb(0.5, 0.5, 0.5);

async function pngBarras(radicado: string): Promise<Buffer> {
  return bwipjs.toBuffer({ bcid: "code128", text: radicado, scale: 3, height: 9, includetext: false });
}

async function pngQr(url: string): Promise<Buffer> {
  return bwipjs.toBuffer({ bcid: "qrcode", text: url, scale: 4 });
}

export type MetadatosDocumentoPdf = {
  csv: string;
  urlValidacion: string;
  urlBaseValidador: string;
  documento: string;
  plataforma: string;
  referencia: string;
  hashArchivo: string | null;
  elementosEstampados: string;
  disenio: number;
};

const CORREO_CONTACTO = "info@cdmb.gov.co";

function partirTexto(texto: string, font: PDFFont, size: number, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split("\n")) {
    let actual = "";
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const candidata = actual ? `${actual} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(candidata, size) <= ancho) {
        actual = candidata;
        continue;
      }
      if (actual) lineas.push(actual);
      let resto = palabra;
      while (font.widthOfTextAtSize(resto, size) > ancho && resto.length > 1) {
        let corte = resto.length - 1;
        while (corte > 1 && font.widthOfTextAtSize(resto.slice(0, corte), size) > ancho) corte--;
        lineas.push(resto.slice(0, corte));
        resto = resto.slice(corte);
      }
      actual = resto;
    }
    lineas.push(actual);
  }
  return lineas;
}

async function agregarDiligencia(
  pdf: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont,
  qr: PDFImage,
  meta: MetadatosDocumentoPdf,
  firmas: FirmaRotuloPdf[],
): Promise<number> {
  const primera = pdf.getPages()[0];
  const [ancho, alto] = primera ? [primera.getWidth(), primera.getHeight()] : [612, 792];
  const margen = 48;
  const util = ancho - margen * 2;
  const NEGRO = rgb(0.1, 0.1, 0.1);
  const BORDE = rgb(0.25, 0.25, 0.25);
  const altoPie = 118;
  const paginasOriginales = pdf.getPageCount();
  const paginasDiligencia: PDFPage[] = [];
  let page = pdf.addPage([ancho, alto]);
  paginasDiligencia.push(page);
  let y = alto - margen;
  const limiteInferior = () => (paginasDiligencia.length === 1 ? margen + altoPie : margen + 20);

  const centrado = (texto: string, size: number, f: PDFFont, color = NEGRO) => {
    page.drawText(texto, { x: (ancho - f.widthOfTextAtSize(texto, size)) / 2, y, size, font: f, color });
  };
  const nuevaPagina = () => {
    page = pdf.addPage([ancho, alto]);
    paginasDiligencia.push(page);
    y = alto - margen;
    centrado("DILIGENCIA DE DOCUMENTO ELECTRÓNICO (continuación)", 9, fontBold);
    y -= 16;
  };

  type Linea = { etiqueta: string; valor: string };
  const TAM = 7;
  const INTERLINEA = 9.2;
  const lineasDeDatos = (datos: Linea[]) =>
    datos.flatMap((d) => {
      const e = `${d.etiqueta}: `;
      const anchoEtiqueta = font.widthOfTextAtSize(e, TAM);
      return partirTexto(d.valor || "—", fontBold, TAM, util - 12 - anchoEtiqueta).map((v, i) => ({ e: i === 0 ? e : "", anchoEtiqueta, v }));
    });

  const seccion = (titulo: string, datos: Linea[]) => {
    const lineas = lineasDeDatos(datos);
    const altoCaja = lineas.length * INTERLINEA + 6;
    if (y - (altoCaja + 11) < limiteInferior()) nuevaPagina();
    page.drawText(titulo, { x: margen, y, size: 7, font: fontBold, color: NEGRO });
    y -= 4;
    page.drawRectangle({ x: margen, y: y - altoCaja, width: util, height: altoCaja, borderColor: BORDE, borderWidth: 0.5 });
    let ly = y - 9.5;
    const primeraLinea = ly;
    for (const l of lineas) {
      if (l.e) page.drawText(l.e, { x: margen + 6, y: ly, size: TAM, font, color: NEGRO });
      page.drawText(l.v, { x: margen + 6 + l.anchoEtiqueta, y: ly, size: TAM, font: fontBold, color: NEGRO });
      ly -= INTERLINEA;
    }
    y -= altoCaja + 9;
    return { pagina: page, primeraLinea };
  };

  centrado("DILIGENCIA DE DOCUMENTO ELECTRÓNICO", 11, fontBold);
  y -= 14;
  for (const l of partirTexto(
    `Documento firmado electrónicamente conforme al artículo 7 de la Ley 527 de 1999 y al Decreto 1074 de 2015. La autenticidad e integridad de cualquier copia, electrónica o en papel, se verifica en ${meta.urlBaseValidador} con el código seguro de verificación (CSV) o el código QR.`,
    font,
    7,
    util,
  )) {
    page.drawText(l, { x: margen, y, size: 7, font, color: NEGRO });
    y -= 9;
  }
  y -= 7;

  const etiquetaDe = (f: FirmaRotuloPdf) => (nivelSello(f.calidad) === "visto" ? "Visto bueno" : etiquetaCalidadCompleta({ rol: "FIRMA", calidad: f.calidad }));
  const ordenadas = ordenarPorCalidad(firmas, (f) => f.calidad, (f) => f.nivel ?? 4);
  ordenadas.forEach((f, i) => {
    const cargo = f.cargo ?? denominacionParaFirma(f.denominacionEmpleo, f.sexo, f.denominacionComplemento);
    const identificacion = textoIdentificacionFirma(f.cedulaONit, f.tipoIdentificacion);
    const evidencia = [f.ip, f.navegador].filter(Boolean).join(" · ");
    seccion(`${ordenadas.length > 1 ? `Firmante ${i + 1} de ${ordenadas.length}` : "Firmante"} · ${etiquetaDe(f)}`, [
      { etiqueta: "Nombre", valor: identificacion ? `${f.nombre} · ${identificacion}` : f.nombre },
      ...(cargo ? [{ etiqueta: "Cargo", valor: cargo }] : []),
      ...(f.actoAdministrativo ? [{ etiqueta: "Acto administrativo", valor: f.actoAdministrativo }] : []),
      ...(f.dependencia ? [{ etiqueta: "Dependencia", valor: f.dependencia }] : []),
      ...(f.selloTiempo || f.fechaHora ? [{ etiqueta: "Fecha y hora (sello de tiempo)", valor: f.selloTiempo ?? f.fechaHora }] : []),
      ...(f.hash ? [{ etiqueta: "Huella de la firma (SHA-256)", valor: f.hash }] : []),
      ...(evidencia ? [{ etiqueta: "IP y navegador", valor: evidencia }] : []),
    ]);
  });

  const datosContenido: Linea[] = [
    { etiqueta: "Documento", valor: meta.documento },
    { etiqueta: "Plataforma", valor: `${meta.plataforma} · CDMB` },
    { etiqueta: "Radicado o expediente", valor: meta.referencia },
    { etiqueta: "Tipo de firma", valor: "Firma electrónica · Ley 527 de 1999, art. 7 · Decreto 1074 de 2015" },
    ...(meta.hashArchivo ? [{ etiqueta: "Huella SHA-256 del documento original (Web Crypto)", valor: meta.hashArchivo }] : []),
    ...(firmas.some((f) => f.selloTiempo?.includes("RFC 3161")) ? [{ etiqueta: "Sello de tiempo", valor: "Token RFC 3161" }] : []),
    { etiqueta: "Verificación pública", valor: "CSV, QR y huella SHA-256 del archivo" },
  ];
  const contenido = seccion("Contenido del documento firmado", [
    ...datosContenido,
    { etiqueta: "Número de páginas (incluida esta diligencia)", valor: "   " },
  ]);

  const total = paginasOriginales + paginasDiligencia.length;
  const etiquetaPaginas = "Número de páginas (incluida esta diligencia): ";
  const lineasContenido = lineasDeDatos(datosContenido).length;
  contenido.pagina.drawText(String(total), {
    x: margen + 6 + font.widthOfTextAtSize(etiquetaPaginas, TAM),
    y: contenido.primeraLinea - lineasContenido * INTERLINEA,
    size: TAM,
    font: fontBold,
    color: NEGRO,
  });

  const resumen = (lista: FirmaRotuloPdf[]) => {
    const grupos = new Map<string, string[]>();
    for (const f of lista) grupos.set(etiquetaDe(f), [...(grupos.get(etiquetaDe(f)) ?? []), f.nombre]);
    return [...grupos.entries()].map(([e, nombres]) => `${e}: ${nombres.join(", ")}`).join("  ·  ");
  };
  const lineasResumenFirmantes = (anchoTexto: number, maxLineas: number): string[] => {
    for (let n = ordenadas.length; n >= 1; n--) {
      const resto = ordenadas.length - n;
      const texto = resumen(ordenadas.slice(0, n)) + (resto > 0 ? `  ·  y ${resto} más` : "");
      const lineas = partirTexto(texto, fontBold, 6.8, anchoTexto);
      if (lineas.length <= maxLineas) return lineas;
    }
    return partirTexto(`${ordenadas.length} firmantes`, fontBold, 6.8, anchoTexto);
  };

  const p = paginasDiligencia[0]!;
  const arriba = margen + 104;
  const abajo = margen + 22;
  for (const yLinea of [arriba, abajo]) {
    p.drawLine({ start: { x: margen, y: yLinea }, end: { x: ancho - margen, y: yLinea }, thickness: 1, color: BORDE, dashArray: [1, 2.5] });
  }
  const qrSize = 72;
  p.drawImage(qr, { x: margen, y: abajo + 5, width: qrSize, height: qrSize });
  const tx = margen + qrSize + 12;
  const anchoTexto = ancho - margen - tx;
  let ty = arriba - 15;
  p.drawText("Código seguro de verificación (CSV): ", { x: tx, y: ty, size: 7.5, font, color: NEGRO });
  p.drawText(meta.csv, { x: tx + font.widthOfTextAtSize("Código seguro de verificación (CSV): ", 7.5), y: ty, size: 7.5, font: fontBold, color: VERDE });
  ty -= 11;
  for (const l of partirTexto(`Verificación: ${meta.urlBaseValidador}`, font, 6.8, anchoTexto)) {
    p.drawText(l, { x: tx, y: ty, size: 6.8, font, color: NEGRO });
    ty -= 8.8;
  }
  ty -= 3;
  const maxLineas = Math.max(1, Math.floor((ty - (abajo + 4)) / 8.8));
  for (const l of lineasResumenFirmantes(anchoTexto, maxLineas)) {
    p.drawText(l, { x: tx, y: ty, size: 6.8, font: fontBold, color: NEGRO });
    ty -= 8.8;
  }
  const contacto = `Contacto del emisor: ${CORREO_CONTACTO}`;
  p.drawText(contacto, { x: (ancho - font.widthOfTextAtSize(contacto, 7)) / 2, y: margen + 8, size: 7, font, color: NEGRO });
  return total;
}

function agregarBandasLaterales(pdf: PDFDocument, font: PDFFont, meta: MetadatosDocumentoPdf) {
  const paginas = pdf.getPages();
  paginas.forEach((page: PDFPage, i) => {
    const texto = `CSV: ${meta.csv}  |  Documento firmado electrónicamente por la CDMB. Verifique su autenticidad en ${meta.urlBaseValidador}  |  Página ${i + 1} de ${paginas.length}`;
    const size = 6;
    const maxAncho = page.getHeight() - 60;
    let t = texto;
    while (font.widthOfTextAtSize(t, size) > maxAncho && t.length > 20) t = t.slice(0, -2);
    page.drawText(t, { x: 14, y: 30, size, font, color: GRIS_CLARO, rotate: degrees(90) });
  });
}

async function completarMetadatos(
  pdf: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont,
  meta: MetadatosDocumentoPdf | undefined,
  firmas: FirmaRotuloPdf[],
) {
  if (!meta || firmas.length === 0) return;
  const qr = await pdf.embedPng(await pngQr(meta.urlValidacion));
  await agregarDiligencia(pdf, font, fontBold, qr, meta, firmas);
  agregarBandasLaterales(pdf, font, meta);
}

export type DatosRotuloPdf = {
  radicado: string;
  tipoEtiqueta: string;
  fechaRadicacion: string;
  dependencia: string | null;
  folios: number;
  serieCodigo: string | null;
  baseUrl: string;
  metadatos?: MetadatosDocumentoPdf;
};

export type FirmaRotuloPdf = {
  nombre: string;
  cedulaONit: string | null;
  tipoIdentificacion?: string | null;
  denominacionEmpleo: string | null;
  denominacionComplemento: string | null;
  sexo: string | null;
  dependencia: string | null;
  fechaHora: string;
  hash: string;
  calidad?: string | null;
  cargo?: string | null;
  actoAdministrativo?: string | null;
  ip?: string | null;
  navegador?: string | null;
  selloTiempo?: string | null;
  nivel?: number;
};

const limpiarCadenas = limpiarCadenasPdf;

export async function estamparRotulo(
  pdfBytes: Buffer | Uint8Array,
  datosOriginales: DatosRotuloPdf,
  firmasOriginales: FirmaRotuloPdf[],
): Promise<Uint8Array> {
  const datos = limpiarCadenas(datosOriginales);
  const firmas = limpiarCadenas(firmasOriginales);
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.getPages()[0];
  if (!page) return pdf.save();
  const { width, height } = page.getSize();

  const [barPngBytes, qrPngBytes] = await Promise.all([
    pngBarras(datos.radicado),
    pngQr(
      firmas.length > 0 && datos.metadatos
        ? datos.metadatos.urlValidacion
        : `${datos.baseUrl.replace(/\/+$/, "")}/verificar/${encodeURIComponent(datos.radicado)}`,
    ),
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

  await completarMetadatos(pdf, font, fontBold, datos.metadatos, firmas);
  return pdf.save();
}

export type DatosFirmaGecon = {
  numeroExpediente: string;
  baseUrl: string;
  metadatos: MetadatosDocumentoPdf;
};

export type DatosFirmaTramite = DatosFirmaGecon;

async function estamparFirmasExpediente(
  pdfBytes: Buffer | Uint8Array,
  datosOriginales: DatosFirmaGecon,
  firmasOriginales: FirmaRotuloPdf[],
): Promise<Uint8Array> {
  const datos = limpiarCadenas(datosOriginales);
  const firmasSinOrden = limpiarCadenas(firmasOriginales);
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  if (firmasSinOrden.length === 0) return pdf.save();
  const firmas = ordenarPorCalidad(firmasSinOrden, (f) => f.calidad, (f) => f.nivel ?? 4);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  if (pdf.getPageCount() === 0) return pdf.save();

  await completarMetadatos(pdf, font, fontBold, datos.metadatos, firmas);
  return pdf.save();
}

export function estamparFirmaGecon(pdfBytes: Buffer | Uint8Array, datos: DatosFirmaGecon, firmas: FirmaRotuloPdf[]): Promise<Uint8Array> {
  return estamparFirmasExpediente(pdfBytes, datos, firmas);
}

export function estamparFirmaTramite(pdfBytes: Buffer | Uint8Array, datos: DatosFirmaTramite, firmas: FirmaRotuloPdf[]): Promise<Uint8Array> {
  return estamparFirmasExpediente(pdfBytes, datos, firmas);
}

export type DatosFirmaSgdea = DatosFirmaGecon;

export function estamparFirmaSgdea(pdfBytes: Buffer | Uint8Array, datos: DatosFirmaSgdea, firmas: FirmaRotuloPdf[]): Promise<Uint8Array> {
  return estamparFirmasExpediente(pdfBytes, datos, firmas);
}
