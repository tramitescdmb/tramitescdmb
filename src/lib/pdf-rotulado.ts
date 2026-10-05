import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import bwipjs from "bwip-js/node";
import { denominacionParaFirma } from "@/lib/denominacion-empleo";
import { ordenarPorCalidad, rotuloCalidadFirma, nivelSello, etiquetaCalidadCompleta } from "@/lib/calidad-firma";
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
  disenio: number;
};

const ENTIDAD_EMISORA = "Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga — CDMB";
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
  const margen = 54;
  const util = ancho - margen * 2;
  const NEGRO = rgb(0.1, 0.1, 0.1);
  const BORDE = rgb(0.25, 0.25, 0.25);
  const altoPie = 150;
  const limiteInferior = margen + altoPie;
  const paginasOriginales = pdf.getPageCount();
  const paginasDiligencia: PDFPage[] = [];
  let page = pdf.addPage([ancho, alto]);
  paginasDiligencia.push(page);
  let y = alto - margen;

  const centrado = (texto: string, size: number, f: PDFFont, color = NEGRO) => {
    page.drawText(texto, { x: (ancho - f.widthOfTextAtSize(texto, size)) / 2, y, size, font: f, color });
  };
  const nuevaPagina = () => {
    page = pdf.addPage([ancho, alto]);
    paginasDiligencia.push(page);
    y = alto - margen;
    centrado("DILIGENCIA DE DOCUMENTO ELECTRÓNICO (continuación)", 10, fontBold);
    y -= 24;
  };

  type Linea = { etiqueta: string; valor: string };
  const TAM = 8;
  const INTERLINEA = 11.5;
  const lineasDeDatos = (datos: Linea[]) =>
    datos.flatMap((d) => {
      const e = `${d.etiqueta}: `;
      const anchoEtiqueta = font.widthOfTextAtSize(e, TAM);
      return partirTexto(d.valor || "—", fontBold, TAM, util - 16 - anchoEtiqueta).map((v, i) => ({ e: i === 0 ? e : "", anchoEtiqueta, v }));
    });

  const seccion = (titulo: string, datos: Linea[]) => {
    const lineas = lineasDeDatos(datos);
    const altoCaja = lineas.length * INTERLINEA + 10;
    if (y - (altoCaja + 18) < limiteInferior) nuevaPagina();
    page.drawText(titulo, { x: margen, y, size: 7.8, font: fontBold, color: NEGRO });
    y -= 6;
    page.drawRectangle({ x: margen, y: y - altoCaja, width: util, height: altoCaja, borderColor: BORDE, borderWidth: 0.6 });
    let ly = y - 13;
    const primeraLinea = ly;
    for (const l of lineas) {
      if (l.e) page.drawText(l.e, { x: margen + 8, y: ly, size: TAM, font, color: NEGRO });
      page.drawText(l.v, { x: margen + 8 + l.anchoEtiqueta, y: ly, size: TAM, font: fontBold, color: NEGRO });
      ly -= INTERLINEA;
    }
    y -= altoCaja + 16;
    return { pagina: page, primeraLinea };
  };

  centrado("DILIGENCIA DE DOCUMENTO ELECTRÓNICO", 13, fontBold);
  y -= 22;
  for (const l of partirTexto(
    `El presente documento se expide conforme a las disposiciones sobre firma electrónica establecidas en el artículo 7 de la Ley 527 de 1999, reglamentado por el Decreto 2364 de 2012 (compilado en el Decreto 1074 de 2015). Contiene un código seguro de verificación (CSV) que permite contrastar la autenticidad e integridad de cualquier copia del mismo, ya sea electrónica o en papel.\nPara realizar la verificación deberá accederse a la dirección ${meta.urlBaseValidador} y facilitar el CSV que figura en esta diligencia (o en el margen de cualquier página del documento firmado), o leer el código QR. Obtendrá los datos del documento original y de las firmas electrónicas registradas.`,
    font,
    7.8,
    util,
  )) {
    page.drawText(l, { x: margen, y, size: 7.8, font, color: NEGRO });
    y -= 10.5;
  }
  y -= 14;
  centrado("Metadatos del documento:", 10.5, fontBold);
  y -= 20;

  seccion("Información para verificación:", [
    { etiqueta: "Código seguro de verificación (CSV)", valor: meta.csv },
    { etiqueta: "Dirección de verificación del documento", valor: meta.urlBaseValidador },
    { etiqueta: "Correo electrónico de contacto del emisor", valor: CORREO_CONTACTO },
  ]);

  const ordenadas = ordenarPorCalidad(firmas, (f) => f.calidad, (f) => f.nivel ?? 4);
  ordenadas.forEach((f, i) => {
    const cargo = f.cargo ?? denominacionParaFirma(f.denominacionEmpleo, f.sexo, f.denominacionComplemento);
    seccion(ordenadas.length > 1 ? `Información asociada al firmante ${i + 1} de ${ordenadas.length}:` : "Información asociada al firmante del documento:", [
      { etiqueta: "Nombre del firmante", valor: f.nombre },
      ...(cargo ? [{ etiqueta: "Cargo del firmante", valor: cargo }] : []),
      { etiqueta: "Organización", valor: /contratista/i.test(cargo ?? "") ? `Contratista de la ${ENTIDAD_EMISORA}` : ENTIDAD_EMISORA },
      ...(f.dependencia ? [{ etiqueta: "Dependencia", valor: f.dependencia }] : []),
      { etiqueta: "Calidad", valor: nivelSello(f.calidad) === "visto" ? "Visto bueno" : etiquetaCalidadCompleta({ rol: "FIRMA", calidad: f.calidad }) },
      ...(f.fechaHora ? [{ etiqueta: "Fecha y hora de la firma", valor: f.fechaHora }] : []),
      ...(f.hash ? [{ etiqueta: "Huella de la firma (SHA-256)", valor: f.hash }] : []),
    ]);
  });

  const datosContenido: Linea[] = [
    { etiqueta: "Documento", valor: meta.documento },
    { etiqueta: "Plataforma", valor: meta.plataforma },
    { etiqueta: "Radicado o expediente", valor: meta.referencia },
    { etiqueta: "Formato del documento", valor: "PDF" },
    { etiqueta: "Tipo de firma", valor: "Firma electrónica (Ley 527 de 1999, art. 7)" },
    { etiqueta: "Emisor de la firma electrónica", valor: "CDMB" },
    ...(meta.hashArchivo ? [{ etiqueta: "Huella SHA-256 del documento original", valor: meta.hashArchivo }] : []),
  ];
  const contenido = seccion("Información asociada al contenido del documento firmado:", [
    ...datosContenido,
    { etiqueta: "Número de páginas del documento (incluida esta diligencia)", valor: "   " },
  ]);

  const total = paginasOriginales + paginasDiligencia.length;
  const etiquetaPaginas = "Número de páginas del documento (incluida esta diligencia): ";
  const lineasContenido = lineasDeDatos(datosContenido).length;
  contenido.pagina.drawText(String(total), {
    x: margen + 8 + font.widthOfTextAtSize(etiquetaPaginas, TAM),
    y: contenido.primeraLinea - lineasContenido * INTERLINEA,
    size: TAM,
    font: fontBold,
    color: NEGRO,
  });

  const etiquetaDe = (f: FirmaRotuloPdf) => (nivelSello(f.calidad) === "visto" ? "Visto bueno" : etiquetaCalidadCompleta({ rol: "FIRMA", calidad: f.calidad }));
  const resumen = (lista: FirmaRotuloPdf[]) => {
    const grupos = new Map<string, string[]>();
    for (const f of lista) grupos.set(etiquetaDe(f), [...(grupos.get(etiquetaDe(f)) ?? []), f.nombre]);
    return [...grupos.entries()].map(([e, nombres]) => `${e}: ${nombres.join(", ")}`).join("  ·  ");
  };
  const lineasResumenFirmantes = (anchoTexto: number, maxLineas: number): string[] => {
    for (let n = ordenadas.length; n >= 1; n--) {
      const resto = ordenadas.length - n;
      const texto = resumen(ordenadas.slice(0, n)) + (resto > 0 ? `  ·  y ${resto} más (ver metadatos)` : "");
      const lineas = partirTexto(texto, fontBold, 7, anchoTexto);
      if (lineas.length <= maxLineas) return lineas;
    }
    return partirTexto(`${ordenadas.length} firmantes (ver metadatos)`, fontBold, 7, anchoTexto);
  };
  for (const p of paginasDiligencia) {
    const arriba = margen + 128;
    const abajo = margen + 36;
    for (const yLinea of [arriba, abajo]) {
      p.drawLine({ start: { x: margen, y: yLinea }, end: { x: ancho - margen, y: yLinea }, thickness: 1, color: BORDE, dashArray: [1, 2.5] });
    }
    const qrSize = 74;
    p.drawImage(qr, { x: margen, y: abajo + 9, width: qrSize, height: qrSize });
    const tx = margen + qrSize + 12;
    const anchoTexto = ancho - margen - tx;
    let ty = arriba - 18;
    p.drawText("Código seguro de verificación (CSV): ", { x: tx, y: ty, size: 8, font, color: NEGRO });
    p.drawText(meta.csv, { x: tx + font.widthOfTextAtSize("Código seguro de verificación (CSV): ", 8), y: ty, size: 8, font: fontBold, color: VERDE });
    ty -= 14;
    for (const l of partirTexto(`La autenticidad de este documento electrónico puede ser contrastada a través de la siguiente dirección: ${meta.urlBaseValidador}`, font, 7, anchoTexto)) {
      p.drawText(l, { x: tx, y: ty, size: 7, font, color: NEGRO });
      ty -= 9.5;
    }
    ty -= 5;
    const maxLineas = Math.max(1, Math.floor((ty - (abajo + 6)) / 9.5));
    for (const l of lineasResumenFirmantes(anchoTexto, maxLineas)) {
      p.drawText(l, { x: tx, y: ty, size: 7, font: fontBold, color: NEGRO });
      ty -= 9.5;
    }
    const contacto = `Para información adicional puede contactar a la CDMB a través del correo electrónico ${CORREO_CONTACTO}`;
    p.drawText(contacto, { x: (ancho - font.widthOfTextAtSize(contacto, 7.5)) / 2, y: margen + 10, size: 7.5, font, color: NEGRO });
  }
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
