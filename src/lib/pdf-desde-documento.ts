"use client";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const ANCHO_A4 = 595.28;
const ALTO_A4 = 841.89;
const MARGEN = 34;
const ESCALA = 2;

export function puntosDeCorte(cuerpo: HTMLElement): number[] {
  const tope = cuerpo.getBoundingClientRect().top;
  const cortes = new Set<number>();
  cuerpo.querySelectorAll<HTMLElement>("[data-pdf-bloque], tr, figure, section, h3, p, li, caption").forEach((el) => {
    const r = el.getBoundingClientRect();
    cortes.add(Math.round(r.top - tope));
    cortes.add(Math.round(r.bottom - tope));
  });
  return [...cortes].sort((a, b) => a - b);
}

export function paginar(alto: number, disponible: number, cortes: number[]): [number, number][] {
  const paginas: [number, number][] = [];
  let inicio = 0;
  while (inicio < alto - 1) {
    const limite = inicio + disponible;
    let fin = alto;
    if (limite < alto) {
      const candidatos = cortes.filter((c) => c > inicio + disponible * 0.3 && c <= limite);
      fin = candidatos.length ? candidatos[candidatos.length - 1]! : limite;
    }
    paginas.push([inicio, fin]);
    inicio = fin;
  }
  return paginas;
}

async function capturar(el: HTMLElement): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas-pro")).default;
  return html2canvas(el, {
    scale: ESCALA,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
}

function recortar(origen: HTMLCanvasElement, desde: number, hasta: number): string {
  const c = document.createElement("canvas");
  c.width = origen.width;
  c.height = Math.max(1, Math.round((hasta - desde) * ESCALA));
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(origen, 0, Math.round(desde * ESCALA), origen.width, c.height, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
}

export async function documentoAPdf(raiz: HTMLElement, titulo: string): Promise<Uint8Array> {
  const encabezado = raiz.querySelector<HTMLElement>("[data-pdf-encabezado]");
  const cuerpo = raiz.querySelector<HTMLElement>("[data-pdf-cuerpo]");
  if (!encabezado || !cuerpo) throw new Error("No se encontró el documento para generar el PDF.");
  await Promise.all(
    Array.from(raiz.querySelectorAll("img")).map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = () => r(null); })))
  );

  const [lienzoEnc, lienzoCuerpo] = await Promise.all([capturar(encabezado), capturar(cuerpo)]);
  const anchoUtil = ANCHO_A4 - MARGEN * 2;
  const k = anchoUtil / cuerpo.offsetWidth;
  const altoEnc = encabezado.offsetHeight * (anchoUtil / encabezado.offsetWidth);
  const disponible = (ALTO_A4 - MARGEN * 2 - altoEnc - 18) / k;
  const paginas = paginar(cuerpo.offsetHeight, disponible, puntosDeCorte(cuerpo));

  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo);
  pdf.setCreator("CDMB");
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  const imgEnc = await pdf.embedJpg(lienzoEnc.toDataURL("image/jpeg", 0.92));
  for (const [i, [desde, hasta]] of paginas.entries()) {
    const page = pdf.addPage([ANCHO_A4, ALTO_A4]);
    page.drawImage(imgEnc, { x: MARGEN, y: ALTO_A4 - MARGEN - altoEnc, width: anchoUtil, height: altoEnc });
    const img = await pdf.embedJpg(recortar(lienzoCuerpo, desde, hasta));
    const alto = (hasta - desde) * k;
    page.drawImage(img, { x: MARGEN, y: ALTO_A4 - MARGEN - altoEnc - 8 - alto, width: anchoUtil, height: alto });
    const pie = `Página ${i + 1} de ${paginas.length}`;
    page.drawText(pie, { x: ANCHO_A4 - MARGEN - fuente.widthOfTextAtSize(pie, 8), y: MARGEN / 2, size: 8, font: fuente, color: rgb(0.4, 0.4, 0.4) });
  }
  return pdf.save();
}
