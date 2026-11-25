import { describe, it, expect } from "vitest";
import { fechaDeCamposVital, fechaDeFilaListado, mejorFechaRadicacionVital, parsearFechaVital } from "@/lib/vital-fecha";

const iso = (d: Date | null) => d?.toISOString() ?? null;

describe("parsearFechaVital", () => {
  it("lee los formatos que entrega VITAL", () => {
    expect(iso(parsearFechaVital("2026-11-17 00:00:00"))).toBe("2026-11-17T00:00:00.000Z");
    expect(iso(parsearFechaVital("2026-11-17"))).toBe("2026-11-17T00:00:00.000Z");
    expect(iso(parsearFechaVital("17/11/2026"))).toBe("2026-11-17T00:00:00.000Z");
    expect(iso(parsearFechaVital("2026-11-17 03:38:42"))).toBe("2026-11-17T08:38:42.000Z");
    expect(iso(parsearFechaVital("2026-11-17T03:38:42Z"))).toBe("2026-11-17T03:38:42.000Z");
    expect(iso(parsearFechaVital("/Date(1763337600000)/"))).toBe("2025-11-17T00:00:00.000Z");
  });
  it("descarta vacíos y valores imposibles", () => {
    for (const v of [null, "", "-2147483648", "2026-02-31", "hola", "1900-01-01", {}]) expect(parsearFechaVital(v)).toBeNull();
  });
});

describe("fechaDeFilaListado", () => {
  it("acepta los distintos nombres del campo", () => {
    expect(iso(fechaDeFilaListado({ FechaRadicacion: "2026-10-01 00:00:00" }))).toBe("2026-10-01T00:00:00.000Z");
    expect(iso(fechaDeFilaListado({ fecha_creacion: "2026-11-17" }))).toBe("2026-11-17T00:00:00.000Z");
    expect(fechaDeFilaListado({ FechaRadicacion: null, nombreActividad: "x" })).toBeNull();
  });
});

describe("fechaDeCamposVital", () => {
  it("toma la fecha de radicación escrita en el formulario", () => {
    expect(iso(fechaDeCamposVital({ "Fecha de Radicación": "17/11/2026", Municipio: "68001" }))).toBe("2026-11-17T00:00:00.000Z");
    expect(fechaDeCamposVital({ "Fecha de inicio de obra": "2026-01-01" })).toBeNull();
  });
});

describe("mejorFechaRadicacionVital", () => {
  it("prefiere la de VITAL y luego el formulario; nunca el nombre de un anexo", () => {
    const listado = new Date("2026-11-20T00:00:00Z");
    expect(mejorFechaRadicacionVital({ listado })?.origen).toBe("vital");
    expect(mejorFechaRadicacionVital({ campos: { "Fecha solicitud": "2026-11-18" } })?.origen).toBe("formulario");
    expect(mejorFechaRadicacionVital({})).toBeNull();
  });
});

import { fechaDeRespuestaVital } from "@/lib/vital-fecha";
describe("fechaDeRespuestaVital", () => {
  it("encuentra la fecha de creación fuera del formulario y prefiere creación sobre radicación", () => {
    expect(iso(fechaDeRespuestaVital({ id_vital: "1", fecha_creacion: "2026-11-17 00:00:00", fechaRadicacion: "2026-11-20" }))).toBe("2026-11-17T00:00:00.000Z");
    expect(iso(fechaDeRespuestaVital([{ numero: 1, datos: { FechaCreacion: "17/11/2026" } }]))).toBe("2026-11-17T00:00:00.000Z");
    expect(fechaDeRespuestaVital({ otro: "x" })).toBeNull();
  });
});
