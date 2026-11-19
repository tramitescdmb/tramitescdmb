import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CODIGO_TRAMITE_POR_VITAL, camposNormalizados, esSolicitudVitalReciente, municipioCdmbDe, partirNombreCompleto, prellenadoDesdeVital } from "@/lib/vital-conversion";
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

describe("prellenadoDesdeVital con formularios reales de VITAL", () => {
  it("persona jurídica de vertimiento al suelo: razón social, representante y su cédula salen del formulario", () => {
    const p = prellenadoDesdeVital({
      solicitanteNombre: null,
      solicitanteIdentificacion: "901159563",
      solicitanteCorreo: "contacto@colegioaldebaran.edu.co",
      solicitanteRaw: [{ tipoPersona: "PERSONA JURÍDICA PÚBLICA", numeroIdentificacion: "901159563", telefono: "0000000", direccionResidencia: "VDA LOS CAUCHOS FINCA CARACOLI", municipioResidencia: "FLORIDABLANCA - Rural", departamentoResidencia: "SANTANDER", paisResidencia: "COLOMBIA" }],
      camposTramite: {
        "Municipio:": "68276",
        "Teléfono(s):": "3163849775",
        "1. tipo de persona:": "Jurídica privada",
        "2. tipo de trámite:": "Nuevo",
        "Correo electrónico:": "contacto@colegioaldebaran.edu.co",
        "Número de documento:": "63338823",
        "Tipo de identificación:": "Cédula de Ciudadanía",
        "3. nombre o razón social:": "COMPLEXUS SAS",
        "Dirección de correspondencia:": "Carrera 49 No 53-78 Apto 201-3",
        "C. poblado/vereda/corregimiento:": "Vereda Los Cauchos",
        "Nombre representante o apoderado:": "ADRIANA JIMENEZ VARGAS",
        "4. información del representante legal:": "Representante Legal",
      },
    });
    expect(p).toMatchObject({
      tipo: "JURIDICA",
      identificacion: "901159563",
      razonSocial: "COMPLEXUS SAS",
      representanteLegal: "ADRIANA JIMENEZ VARGAS",
      representanteIdentificacion: "63338823",
      telefono: "3163849775",
      direccion: "VDA LOS CAUCHOS FINCA CARACOLI",
      municipioSolicitante: "Floridablanca",
      municipio: "Floridablanca",
      predioDireccion: "Vereda Los Cauchos",
      claseSolicitud: "NUEVA",
    });
  });

  it("persona natural sin nombres separados: los parte desde «Nombres y apellidos»", () => {
    const p = prellenadoDesdeVital({
      solicitanteNombre: null,
      solicitanteIdentificacion: null,
      solicitanteCorreo: null,
      solicitanteRaw: [{ tipoPersona: "Persona natural" }],
      camposTramite: { "Nombres y apellidos:": "Carlos arturo Avila muñoz", "Número de documento": "1057571120", "Teléfono/celular:": "3123627319", "Tipo de identificación:": "-2147483648", "Nombre del predio:": "PRIMER LOTE", "Dirección del predio:": "Km 5 vía Girón" },
    });
    expect(p).toMatchObject({ tipo: "NATURAL", nombres: "Carlos arturo", apellidos: "Avila muñoz", identificacion: "1057571120", telefono: "3123627319", predioNombre: "PRIMER LOTE", predioDireccion: "Km 5 vía Girón" });
  });

  it("descarta los valores vacíos de VITAL", () => {
    expect(camposNormalizados({ "Representante legal": "-2147483648", "3. nombre representante legal o apoderado:": "YALIDE" })).toEqual([["nombre representante legal o apoderado", "YALIDE"]]);
  });

  it("partirNombreCompleto", () => {
    expect(partirNombreCompleto("Ana Pérez")).toEqual({ nombres: "Ana", apellidos: "Pérez" });
    expect(partirNombreCompleto("Edilberto Anaya Velasco")).toEqual({ nombres: "Edilberto", apellidos: "Anaya Velasco" });
  });
});
