import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import bwipjs from "bwip-js/node";
import { denominacionParaFirma } from "@/lib/denominacion-empleo";
import { ordenarPorCalidad, rotuloCalidadFirma, nivelSello, etiquetaCalidadCompleta } from "@/lib/calidad-firma";
import { textoIdentificacionFirma } from "@/lib/identificacion-firma";

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
};

const ENTIDAD_EMISORA = "Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga — CDMB";

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
  const margen = 54;
  const util = ancho - margen * 2;
  const paginasOriginales = pdf.getPageCount();
  let page = pdf.addPage([ancho, alto]);
  let y = alto - margen;
  let paginasDiligencia = 1;

  const nuevaPagina = () => {
    page = pdf.addPage([ancho, alto]);
    paginasDiligencia++;
    y = alto - margen;
    page.drawText("DILIGENCIA DE DOCUMENTO ELECTRÓNICO (continuación)", { x: margen, y, size: 9, font: fontBold, color: VERDE });
    y -= 22;
  };
  const asegurar = (necesario: number) => {
    if (y - necesario < margen + 10) nuevaPagina();
  };
  const titulo = (texto: string) => {
    asegurar(30);
    y -= 6;
    page.drawText(texto, { x: margen, y, size: 8.5, font: fontBold, color: VERDE });
    y -= 4;
    page.drawLine({ start: { x: margen, y }, end: { x: ancho - margen, y }, thickness: 0.5, color: VERDE });
    y -= 12;
  };
  const dato = (etiqueta: string, valor: string) => {
    const e = `${etiqueta}: `;
    const anchoEtiqueta = fontBold.widthOfTextAtSize(e, 7.5);
    const lineas = partirTexto(valor || "—", font, 7.5, util - anchoEtiqueta);
    asegurar(lineas.length * 10 + 2);
    page.drawText(e, { x: margen, y, size: 7.5, font: fontBold, color: GRIS });
    lineas.forEach((l, i) => {
      page.drawText(l, { x: margen + anchoEtiqueta, y: y - i * 10, size: 7.5, font, color: GRIS });
    });
    y -= lineas.length * 10 + 2;
  };
  const parrafo = (texto: string, size = 7) => {
    const lineas = partirTexto(texto, font, size, util);
    for (const l of lineas) {
      asegurar(size + 3);
      page.drawText(l, { x: margen, y, size, font, color: GRIS_CLARO });
      y -= size + 3;
    }
  };

  const qrSize = 72;
  page.drawImage(qr, { x: ancho - margen - qrSize, y: y - qrSize + 10, width: qrSize, height: qrSize });
  page.drawText("DILIGENCIA DE DOCUMENTO ELECTRÓNICO", { x: margen, y, size: 13, font: fontBold, color: VERDE });
  y -= 16;
  page.drawText("Metadatos del documento", { x: margen, y, size: 9, font, color: GRIS });
  y -= 14;
  page.drawText(ENTIDAD_EMISORA, { x: margen, y, size: 7.5, font, color: GRIS_CLARO });
  y = Math.min(y - 20, alto - margen - qrSize - 8);

  titulo("Información para verificación");
  dato("Código seguro de verificación (CSV)", meta.csv);
  dato("Dirección de verificación del documento", meta.urlBaseValidador);
  dato("Entidad emisora", ENTIDAD_EMISORA);
  dato("Plataforma", meta.plataforma);

  titulo("Información asociada al contenido del documento firmado");
  dato("Documento", meta.documento);
  dato("Radicado o expediente", meta.referencia);
  dato("Formato del documento", "PDF");
  if (meta.hashArchivo) dato("Huella SHA-256 del documento original", meta.hashArchivo);
  const yNumeroPaginas = y;
  const paginaNumero = page;
  dato("Número de páginas (incluida esta diligencia)", "    ");

  titulo("Información asociada a la firma");
  dato("Tipo de firma", "Firma electrónica (artículo 7 de la Ley 527 de 1999; Decreto 2364 de 2012, compilado en el Decreto 1074 de 2015)");
  dato("Mecanismo", "Autenticación del firmante en la plataforma, huella SHA-256 del contenido y sello de tiempo");
  dato("Emisor de la firma", "CDMB — firma electrónica de la plataforma institucional; no corresponde a un certificado digital de una entidad de certificación");

  const ordenadas = ordenarPorCalidad(firmas, (f) => f.calidad, (f) => f.nivel ?? 4);
  ordenadas.forEach((f, i) => {
    asegurar(7 * 12 + 34);
    titulo(`Firmante ${i + 1} de ${ordenadas.length}`);
    const cargo = f.cargo ?? denominacionParaFirma(f.denominacionEmpleo, f.sexo, f.denominacionComplemento);
    dato("Nombre del firmante", f.nombre);
    if (cargo) dato("Cargo del firmante", cargo);
    dato("Organización", ENTIDAD_EMISORA);
    if (f.dependencia) dato("Dependencia", f.dependencia);
    dato("Calidad", nivelSello(f.calidad) === "visto" ? "Visto bueno" : etiquetaCalidadCompleta({ rol: "FIRMA", calidad: f.calidad }));
    if (f.fechaHora) dato("Fecha y hora de la firma", f.fechaHora);
    if (f.hash) dato("Huella de la firma (SHA-256)", f.hash);
  });

  titulo("Validez");
  parrafo(
    `El presente documento se expide conforme a las disposiciones sobre firma electrónica del artículo 7 de la Ley 527 de 1999, reglamentado por el Decreto 2364 de 2012 (compilado en el Decreto 1074 de 2015). Contiene un código seguro de verificación (CSV) que permite contrastar la autenticidad e integridad de cualquier copia, electrónica o en papel. Para verificarlo, ingrese a ${meta.urlBaseValidador} y digite el CSV que figura en esta diligencia y en el margen de cada página, o lea el código QR. Obtendrá los datos del documento original y de las firmas registradas.`,
  );

  const total = paginasOriginales + paginasDiligencia;
  paginaNumero.drawText(String(total), {
    x: margen + fontBold.widthOfTextAtSize("Número de páginas (incluida esta diligencia): ", 7.5),
    y: yNumeroPaginas,
    size: 7.5,
    font,
    color: GRIS,
  });
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
  if (!meta) return;
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
  nivel?: number;
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
    pngQr(datos.metadatos?.urlValidacion ?? `${datos.baseUrl.replace(/\/+$/, "")}/verificar/${encodeURIComponent(datos.radicado)}`),
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
    for (const f of ordenarPorCalidad(firmas, (x) => x.calidad, (x) => x.nivel ?? 4)) {
      const cargo = f.cargo ?? denominacionParaFirma(f.denominacionEmpleo, f.sexo, f.denominacionComplemento);
      const identificacion = textoIdentificacionFirma(f.cedulaONit, f.tipoIdentificacion);
      const rotulo = rotuloCalidadFirma(f.calidad);
      const nombreLinea = `${rotulo ? `${rotulo}: ` : ""}${identificacion ? `${f.nombre} — ${identificacion}` : f.nombre}`;
      page.drawText(nombreLinea.slice(0, 100), { x: 24, y: cy, size: 6.5, font: fontBold, color: GRIS }); cy -= lh;
      if (cargo) { page.drawText(cargo.slice(0, 100), { x: 24, y: cy, size: 6, font, color: GRIS }); cy -= lh; }
      if (f.dependencia) { page.drawText(f.dependencia.slice(0, 100), { x: 24, y: cy, size: 6, font, color: GRIS }); cy -= lh; }
      page.drawText(`${f.fechaHora}  ·  SHA-256 ${f.hash.slice(0, 16)}…`, { x: 24, y: cy, size: 5.5, font, color: GRIS_CLARO });
      cy -= lh + 3;
    }
    page.drawText("Firma electrónica · Ley 527 de 1999 · Decreto 1074 de 2015", { x: 24, y: cy, size: 5.5, font, color: GRIS_CLARO });
  }

  await completarMetadatos(pdf, font, fontBold, datos.metadatos, firmas);
  return pdf.save();
}

export type DatosFirmaGecon = {
  numeroExpediente: string;
  baseUrl: string;
  metadatos?: MetadatosDocumentoPdf;
};

export type DatosFirmaTramite = DatosFirmaGecon;

async function estamparFirmasExpediente(
  pdfBytes: Buffer | Uint8Array,
  datos: DatosFirmaGecon,
  firmasSinOrden: FirmaRotuloPdf[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  if (firmasSinOrden.length === 0) return pdf.save();
  const firmas = ordenarPorCalidad(firmasSinOrden, (f) => f.calidad, (f) => f.nivel ?? 4);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.getPages()[0];
  if (!page) return pdf.save();
  const { width, height } = page.getSize();

  const qrPngBytes = await pngQr(datos.metadatos?.urlValidacion ?? `${datos.baseUrl.replace(/\/+$/, "")}/verificar/${encodeURIComponent(datos.numeroExpediente)}`);
  const qr = await pdf.embedPng(qrPngBytes);

  const qrSize = 49;
  const qx = Math.max(12, width - qrSize - 20);
  const qy = Math.max(12, height - qrSize - 20);
  page.drawImage(qr, { x: qx, y: qy, width: qrSize, height: qrSize });
  page.drawText("Verifique esta firma", { x: qx, y: qy - 9, size: 5.5, font, color: GRIS_CLARO });

  const PRINCIPAL = { nombre: 6.5, linea: 6, meta: 5.5, lh: 7.4 };
  const SECUNDARIA = { nombre: 5.4, linea: 4.8, meta: 4.4, lh: 6.6 };
  const VISTO = { texto: 4.2, lh: 7.5 };
  const altoDe = (f: FirmaRotuloPdf) => {
    const nivel = nivelSello(f.calidad);
    if (nivel === "visto") return VISTO.lh + 1.5;
    if (nivel === "secundaria") return 3 * SECUNDARIA.lh + 3;
    return 6 * PRINCIPAL.lh + 3;
  };
  const soloVistoBueno = firmas.every((f) => nivelSello(f.calidad) === "visto");
  const altoTotal = firmas.reduce((acc, f) => acc + altoDe(f), 0);
  let cy = 18 + 12 + altoTotal + 8;
  page.drawLine({ start: { x: 24, y: cy }, end: { x: width - 24, y: cy }, thickness: 0.5, color: VERDE });
  cy -= 9;
  page.drawText(soloVistoBueno ? "VISTO BUENO ELECTRÓNICO" : "DOCUMENTO FIRMADO ELECTRÓNICAMENTE", { x: 24, y: cy, size: 6, font: fontBold, color: VERDE });
  cy -= 11;

  const conRotulo = (rotulo: string, resto: string, size: number, fuenteResto = fontBold) => {
    const etiqueta = `${rotulo}: `;
    page.drawText(etiqueta, { x: 24, y: cy, size, font: fontBold, color: VERDE });
    page.drawText(resto.slice(0, 160), { x: 24 + fontBold.widthOfTextAtSize(etiqueta, size), y: cy, size, font: fuenteResto, color: GRIS });
  };

  for (const f of firmas) {
    const nivel = nivelSello(f.calidad);
    const cargo = f.cargo ?? denominacionParaFirma(f.denominacionEmpleo, f.sexo, f.denominacionComplemento);
    const rotulo = rotuloCalidadFirma(f.calidad);

    if (nivel === "visto") {
      const resto = [f.nombre, textoIdentificacionFirma(f.cedulaONit, f.tipoIdentificacion), cargo, f.dependencia, f.fechaHora].filter(Boolean).join("  ·  ");
      conRotulo(rotulo ?? "Visto bueno", resto, VISTO.texto, font);
      cy -= VISTO.lh + 1.5;
      continue;
    }

    if (nivel === "secundaria") {
      const s = SECUNDARIA;
      const identificacion = textoIdentificacionFirma(f.cedulaONit, f.tipoIdentificacion);
      const identidad = identificacion ? `${f.nombre}  ·  ${identificacion}` : f.nombre;
      conRotulo(rotulo ?? "", identidad, s.nombre);
      cy -= s.lh;
      const detalle = [cargo, f.dependencia].filter(Boolean).join("  ·  ");
      if (detalle) page.drawText(detalle.slice(0, 160), { x: 24, y: cy, size: s.linea, font, color: GRIS });
      cy -= s.lh;
      page.drawText(`${f.fechaHora}  ·  SHA-256: ${f.hash}`, { x: 24, y: cy, size: s.meta, font, color: GRIS_CLARO });
      cy -= s.lh + 3;
      continue;
    }

    const p = PRINCIPAL;
    page.drawText(f.nombre.slice(0, 100), { x: 24, y: cy, size: p.nombre, font: fontBold, color: GRIS });
    cy -= p.lh;
    const identificacion = textoIdentificacionFirma(f.cedulaONit, f.tipoIdentificacion);
    if (identificacion) {
      page.drawText(identificacion, { x: 24, y: cy, size: p.linea, font, color: GRIS });
      cy -= p.lh;
    }
    if (cargo) {
      page.drawText(cargo.slice(0, 100), { x: 24, y: cy, size: p.linea, font, color: GRIS });
      cy -= p.lh;
    }
    if (f.dependencia) {
      page.drawText(f.dependencia.slice(0, 100), { x: 24, y: cy, size: p.linea, font, color: GRIS });
      cy -= p.lh;
    }
    page.drawText(f.fechaHora, { x: 24, y: cy, size: p.meta, font, color: GRIS_CLARO });
    cy -= p.lh;
    page.drawText(`SHA-256: ${f.hash}`, { x: 24, y: cy, size: p.meta, font, color: GRIS_CLARO });
    cy -= p.lh + 3;
  }
  page.drawText("Firma electrónica · Ley 527 de 1999 · Decreto 1074 de 2015", { x: 24, y: cy, size: 5.5, font, color: GRIS_CLARO });

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
