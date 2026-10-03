import { describe, expect, it } from "vitest";
import { recomendarSubserieContrato, type SerieCatalogo } from "./trd-recomendacion-contrato";

const sub = (codigo: string, nombre: string) => ({ id: codigo, codigo, nombre });
const catalogo: SerieCatalogo[] = [
  {
    id: "contratos",
    nombre: "CONTRATOS",
    dependenciaNombre: "Oficina de Contratación",
    subseries: [
      sub("210.1", "Contratos de Arrendamiento"),
      sub("210.3", "Contratos de compraventa"),
      sub("210.4", "Contratos de Consultoría"),
      sub("210.6", "Contratos de Obra"),
      sub("210.8", "Contratos de Prestación de Servicios"),
      sub("210.9", "Contratos de Seguros"),
      sub("210.11", "Contratos de Suministro"),
      sub("210.12", "Contratos interadministrativos"),
    ],
  },
  {
    id: "convenios",
    nombre: "CONVENIOS",
    dependenciaNombre: "Oficina de Contratación",
    subseries: [
      sub("220.1", "Convenios de cooperación internacional"),
      sub("220.2", "Convenios de cooperación nacional"),
      sub("220.4", "Convenios interadministrativos"),
    ],
  },
  { id: "actas", nombre: "ACTAS", dependenciaNombre: "Oficina de Contratación", subseries: [sub("20.12", "Actas de Comité Primario")] },
  { id: "otra", nombre: "CONTRATOS", dependenciaNombre: "Secretaría General", subseries: [sub("210.8", "Contratos de Prestación de Servicios")] },
];

const subserie = (objeto: string) => recomendarSubserieContrato(objeto, catalogo)?.subserieId ?? null;

describe("recomendarSubserieContrato", () => {
  it("reconoce los tipos de contrato más frecuentes, con o sin tildes", () => {
    expect(subserie("Prestación de servicios profesionales como abogado en la Secretaría General")).toBe("210.8");
    expect(subserie("PRESTAR SERVICIOS DE APOYO A LA GESTION")).toBe("210.8");
    expect(subserie("Construcción de obras de mitigación en la quebrada La Iglesia")).toBe("210.6");
    expect(subserie("Interventoría técnica, administrativa y financiera")).toBe("210.4");
    expect(subserie("Suministro de combustible para el parque automotor")).toBe("210.11");
    expect(subserie("Arrendamiento de bodega para archivo central")).toBe("210.1");
    expect(subserie("Adquisición de equipos de cómputo")).toBe("210.3");
    expect(subserie("Programa de seguros de la entidad")).toBe("210.9");
  });

  it("distingue convenios de contratos interadministrativos", () => {
    expect(subserie("Convenio interadministrativo con el municipio de Girón")).toBe("220.4");
    expect(subserie("Contrato interadministrativo con la Universidad Industrial de Santander")).toBe("210.12");
    expect(subserie("Convenio de cooperación con la GIZ en el marco de cooperación internacional")).toBe("220.1");
    expect(subserie("Convenio de cooperación con la fundación")).toBe("220.2");
  });

  it("solo recomienda subseries de la Oficina de Contratación", () => {
    const r = recomendarSubserieContrato("prestación de servicios", catalogo);
    expect(r?.serieId).toBe("contratos");
    expect(r?.motivo).toContain("prestación de servicios");
  });

  it("no inventa una clasificación si no reconoce el tipo de contrato", () => {
    expect(subserie("Objeto pendiente por definir")).toBeNull();
    expect(subserie("")).toBeNull();
  });
});
