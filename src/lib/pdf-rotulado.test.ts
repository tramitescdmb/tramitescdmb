import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { estamparFirmaGecon, type FirmaRotuloPdf } from "./pdf-rotulado";
import { metadatosPdf } from "./metadatos-pdf";
import { extraerTextoPdf } from "./texto-pdf";

async function pdfEnBlanco(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  return pdf.save();
}

const firmante = (extra: Partial<FirmaRotuloPdf> = {}): FirmaRotuloPdf => ({
  nombre: "Luis Alfonso Lozano Camacho",
  cedulaONit: "13743564",
  tipoIdentificacion: "CC",
  denominacionEmpleo: null,
  denominacionComplemento: null,
  sexo: "M",
  dependencia: "Oficina Asesora de Direccionamiento Estratégico Institucional",
  fechaHora: "15 de octubre de 2026, 10:00 a. m.",
  hash: "a".repeat(64),
  calidad: "PRINCIPAL",
  cargo: "Profesional Especializado de Tecnologías de Información",
  nivel: 4,
  ...extra,
});

async function textoSellado(firmas: FirmaRotuloPdf[]): Promise<string> {
  const baseUrl = "https://tramites.example";
  const datos = {
    numeroExpediente: "CDMB-CTO-2026-000039",
    baseUrl,
    metadatos: metadatosPdf({ tipo: "G", id: "doc1", baseUrl, documento: "Acta de inicio", referencia: "CDMB-CTO-2026-000039", hashArchivo: "b".repeat(64) }),
  };
  return (await extraerTextoPdf(await estamparFirmaGecon(await pdfEnBlanco(), datos, firmas))) ?? "";
}

describe("sello de firma GECON", () => {
  it("el documento no lleva bloque de firmas: la información está en la diligencia", async () => {
    const texto = await textoSellado([firmante()]);
    expect(texto).not.toMatch(/DOCUMENTO FIRMADO ELECTRÓNICAMENTE/);
    expect(texto).toMatch(/DILIGENCIA DE DOCUMENTO ELECTRÓNICO/);
  });

  it("imprime el acto administrativo justo debajo del cargo", async () => {
    const texto = await textoSellado([firmante({ actoAdministrativo: "Resolución 560 de 2026" })]);
    const cargo = texto.indexOf("Profesional Especializado de Tecnologías de Información");
    const acto = texto.indexOf("Resolución 560 de 2026");
    const dependencia = texto.indexOf("Oficina Asesora de Direccionamiento");
    expect(cargo).toBeGreaterThan(-1);
    expect(acto).toBeGreaterThan(cargo);
    expect(dependencia).toBeGreaterThan(acto);
  });

  it("la diligencia es compacta: cédula con el nombre, fecha con sello de tiempo e IP con navegador en una línea", async () => {
    const texto = await textoSellado([
      firmante({ cargo: "Contratista", calidad: "PROYECTO", ip: "190.145.254.226", navegador: "Chrome 141 en Windows 10/11", selloTiempo: "15 de octubre de 2026 a las 12:12 p. m." }),
    ]);
    expect(texto).not.toMatch(/Contratista de la|Organización|Bitácora|Evidencia registrada|DOCUMENTO FIRMADO ELECTRÓNICAMENTE/);
    expect(texto).toMatch(/Firmante · Proyectó/);
    expect(texto).toMatch(/Nombre: Luis Alfonso Lozano Camacho · C\.C\. 13743564/);
    expect(texto).toMatch(/Ley 527 de 1999, art\. 7 · Decreto 1074 de 2015/);
    expect(texto).toMatch(/Fecha y hora \(sello de tiempo\): 15 de octubre de 2026 a las 12:12 p\. m\./);
    expect(texto).toMatch(/IP y navegador: 190\.145\.254\.226 · Chrome 141 en Windows 10\/11/);
    expect(texto).toMatch(/Web Crypto/);
    expect(texto).toMatch(/Verificación pública/);
  });

  it("sin acto administrativo no agrega ninguna línea", async () => {
    const texto = await textoSellado([firmante()]);
    expect(texto).not.toMatch(/Resolución|Acto administrativo/);
  });
});
