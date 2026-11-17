import { describe, expect, it } from "vitest";
import {
  carpetaComunicacion,
  carpetaContrato,
  carpetaDocumental,
  carpetaTramite,
  carpetaVital,
  estaEnCarpeta,
  nombreArchivo,
  nombreSinSello,
  rutaDestino,
  segmento,
  subcarpetaTramite,
  variante,
} from "./carpetas-almacen";

describe("nombres seguros", () => {
  it("segmento: sin tildes, sin barras ni puntos, nunca vacío", () => {
    expect(segmento("Oficina Jurídica / Contratación")).toBe("Oficina-Juridica-Contratacion");
    expect(segmento("../..")).toBe("sin-nombre");
    expect(segmento("")).toBe("sin-nombre");
    expect(segmento(null)).toBe("sin-nombre");
    expect(segmento("M-DA-PR39-2026-0012")).toBe("M-DA-PR39-2026-0012");
    expect(segmento("a".repeat(200)).length).toBe(80);
  });
  it("nombreArchivo conserva la extensión y quita lo raro", () => {
    expect(nombreArchivo("Acta de visita (firmada).PDF")).toBe("Acta_de_visita_firmada.pdf");
    expect(nombreArchivo("Resolución Nº 15.docx")).toBe("Resolucion_N_15.docx");
    expect(nombreArchivo("../../etc/passwd")).toBe("passwd");
    expect(nombreArchivo(".bashrc")).toBe("bashrc");
    expect(nombreArchivo("...")).toBe("archivo");
  });
  it("quita el sello de tiempo de la carpeta de llegada", () => {
    expect(nombreSinSello("1731600000000-Acta.pdf")).toBe("Acta.pdf");
    expect(nombreSinSello("2026-informe.pdf")).toBe("2026-informe.pdf");
  });
  it("variante agrega _2, _3 antes de la extensión", () => {
    expect(variante("A/b/Acta.pdf", 1)).toBe("A/b/Acta.pdf");
    expect(variante("A/b/Acta.pdf", 2)).toBe("A/b/Acta_2.pdf");
    expect(variante("A/b.c/Acta", 3)).toBe("A/b.c/Acta_3");
  });
});

describe("estructura por módulo", () => {
  it("GECON: vigencia / tipo de contrato / contrato / etapa", () => {
    expect(carpetaContrato({ vigencia: 2026, tipoContrato: "PRESTACION_SERVICIOS", numeroContrato: "1520-2026", numero: "CDMB-CTO-2026-000003" })).toBe(
      "Gecon/2026/prestacion-de-servicios/contrato-1520-2026"
    );
    expect(carpetaContrato({ vigencia: 2026, tipoContrato: "OBRA", numeroContrato: "050", numero: "CDMB-CTO-2026-000004" })).toBe("Gecon/2026/obra/contrato-050-2026");
    expect(carpetaContrato({ vigencia: 2027, tipoContrato: "SUMINISTRO", numeroContrato: null, numero: "CDMB-CTO-2026-000005" })).toBe(
      "Gecon/2027/suministro/expediente-CDMB-CTO-2026-000005"
    );
    expect(carpetaContrato({ vigencia: 2026, tipoContrato: "OBRA", numeroContrato: "12/2026", numero: "x" })).toBe("Gecon/2026/obra/contrato-12-2026");
  });
  it("Trámites: año / tipo / expediente / radicación, pasos, conceptos y visitas", () => {
    const base = carpetaTramite({ anio: 2026, tipo: "concesion-de-aguas-superficiales", numero: "M-DA-PR39-2026-0012" });
    expect(base).toBe("Tramites/2026/concesion-de-aguas-superficiales/M-DA-PR39-2026-0012");
    expect(subcarpetaTramite({ pasoNumero: null })).toBe("radicacion");
    expect(subcarpetaTramite({ pasoNumero: 3 })).toBe("paso-03");
    expect(subcarpetaTramite({ pasoNumero: 4, esConcepto: true })).toBe("conceptos");
    expect(subcarpetaTramite({ fechaVisita: "2026-11-14" })).toBe("visitas/2026-11-14");
  });
  it("Correspondencia, SGDEA y VITAL", () => {
    expect(carpetaComunicacion({ anio: 2026, tipo: "RECIBIDA", radicado: "CDMB-R-2026-000123" })).toBe("Correspondencia/2026/recibidas/CDMB-R-2026-000123");
    expect(carpetaComunicacion({ anio: 2026, tipo: "INTERNA", radicado: "CDMB-I-2026-000001" })).toBe("Correspondencia/2026/internas/CDMB-I-2026-000001");
    expect(carpetaDocumental({ anio: 2026, dependencia: { codigo: "110", nombre: "Oficina Jurídica" }, numero: "CDMB-X-2026-000004" })).toBe(
      "SGDEA/2026/110-Oficina-Juridica/CDMB-X-2026-000004"
    );
    expect(carpetaVital({ anio: 2025, idVital: "3500000000123" })).toBe("Vital/2025/3500000000123");
  });
  it("ruta destino y comprobación de carpeta", () => {
    expect(rutaDestino("Gecon/2026/obra/contrato-1-2026/contractual", "_subidas/abc/1731600000000-Informe octubre.pdf")).toBe(
      "Gecon/2026/obra/contrato-1-2026/contractual/Informe_octubre.pdf"
    );
    expect(estaEnCarpeta("A/b/c.pdf", "A/b")).toBe(true);
    expect(estaEnCarpeta("A/b/d/c.pdf", "A/b")).toBe(false);
    expect(estaEnCarpeta("A/bb/c.pdf", "A/b")).toBe(false);
  });
});
