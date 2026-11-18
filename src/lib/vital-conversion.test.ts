import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CODIGO_TRAMITE_POR_VITAL, esSolicitudVitalReciente, municipioCdmbDe, prellenadoDesdeVital } from "@/lib/vital-conversion";
import { FUERA_DE_JURISDICCION } from "@/lib/municipios";

describe("CODIGO_TRAMITE_POR_VITAL", () => {
  it("solo apunta a trámites que existen y tienen flujo", () => {
    const dir = join(__dirname, "..", "..", "data", "tramites");
    const conFlujo = new Set(
      readdirSync(dir)
        .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
        .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as { codigo: string; flujos: unknown[] })
        .filter((t) => t.flujos.length > 0)
        .map((t) => t.codigo)
    );
    for (const codigo of Object.values(CODIGO_TRAMITE_POR_VITAL)) expect(conFlujo.has(codigo), codigo).toBe(true);
  });
});

describe("esSolicitudVitalReciente", () => {
  const ahora = new Date("2026-11-18T12:00:00Z");
  it("cuenta las de los últimos 60 días y las sin fecha", () => {
    expect(esSolicitudVitalReciente(new Date("2026-11-01"), ahora)).toBe(true);
    expect(esSolicitudVitalReciente(null, ahora)).toBe(true);
    expect(esSolicitudVitalReciente(new Date("2026-08-01"), ahora)).toBe(false);
  });
});

describe("municipioCdmbDe", () => {
  it("reconoce nombre, código DANE y fuera de jurisdicción", () => {
    expect(municipioCdmbDe("GIRON")).toBe("Girón");
    expect(municipioCdmbDe("68001")).toBe("Bucaramanga");
    expect(municipioCdmbDe("Medellín")).toBe(FUERA_DE_JURISDICCION);
    expect(municipioCdmbDe("")).toBe("");
  });
});

describe("prellenadoDesdeVital", () => {
  it("toma persona natural, contacto, municipio y punto", () => {
    const p = prellenadoDesdeVital({
      solicitanteNombre: "Ana Pérez",
      solicitanteIdentificacion: "123",
      solicitanteCorreo: null,
      solicitanteRaw: [{ tipoPersona: "Natural", primerNombre: "Ana", primerApellido: "Pérez", segundoApellido: "Gómez", numeroIdentificacion: 123, correoElectronico: "ana@x.co", telefono: "300", municipioResidencia: "Floridablanca" }],
      camposTramite: { Municipio: "68276", "Dirección del predio": "Vereda X", Latitud: "7.1", Longitud: "-73.1" },
    });
    expect(p).toMatchObject({ tipo: "NATURAL", nombres: "Ana", apellidos: "Pérez Gómez", identificacion: "123", email: "ana@x.co", municipioSolicitante: "Floridablanca", predioDireccion: "Vereda X" });
    expect(p.razonSocial).toBe("");
  });
  it("toma persona jurídica por razón social", () => {
    const p = prellenadoDesdeVital({ solicitanteNombre: null, solicitanteIdentificacion: "900", solicitanteCorreo: "e@x.co", solicitanteRaw: { razonSocial: "Empresa SAS" }, camposTramite: null });
    expect(p).toMatchObject({ tipo: "JURIDICA", razonSocial: "Empresa SAS", identificacion: "900", email: "e@x.co", nombres: "", municipio: "" });
  });
});
