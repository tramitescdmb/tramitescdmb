import { describe, expect, it } from "vitest";
import {
  desdeLatLon,
  desdePlanas,
  desdeCartesianas,
  esLatLonValido,
  esPlanaColombiaAprox,
  esCartesianaValida,
} from "./coordenadas";

// Bucaramanga (centro de la jurisdicción CDMB), como punto de referencia real para las tres pruebas
// de ida y vuelta — si alguna vez se transcribe mal el string PLANAS/CARTESIANAS (ver el comentario en
// coordenadas.ts sobre el factor de escala 0.9992), estas pruebas deberían dejar de cuadrar.
const BUCARAMANGA = { lat: 7.119349, lon: -73.1227416 };

describe("desdeLatLon", () => {
  it("calcula planas y cartesianas para un punto real de la jurisdicción CDMB", () => {
    const c = desdeLatLon(BUCARAMANGA.lat, BUCARAMANGA.lon);
    expect(esPlanaColombiaAprox(c.planaX, c.planaY)).toBe(true);
    expect(esCartesianaValida(c.cartesianaX, c.cartesianaY, c.cartesianaZ)).toBe(true);
  });
});

describe("ida y vuelta entre representaciones", () => {
  it("lat/lon → planas → lat/lon vuelve al mismo punto (±0.0001°)", () => {
    const ida = desdeLatLon(BUCARAMANGA.lat, BUCARAMANGA.lon);
    const vuelta = desdePlanas(ida.planaX, ida.planaY);
    expect(vuelta.lat).toBeCloseTo(BUCARAMANGA.lat, 4);
    expect(vuelta.lon).toBeCloseTo(BUCARAMANGA.lon, 4);
  });

  it("lat/lon → cartesianas → lat/lon vuelve al mismo punto (±0.0001°)", () => {
    const ida = desdeLatLon(BUCARAMANGA.lat, BUCARAMANGA.lon, 950);
    const vuelta = desdeCartesianas(ida.cartesianaX, ida.cartesianaY, ida.cartesianaZ);
    expect(vuelta.lat).toBeCloseTo(BUCARAMANGA.lat, 4);
    expect(vuelta.lon).toBeCloseTo(BUCARAMANGA.lon, 4);
  });
});

describe("validaciones de rango", () => {
  it("esLatLonValido rechaza fuera de [-90,90]/[-180,180] y NaN", () => {
    expect(esLatLonValido(BUCARAMANGA.lat, BUCARAMANGA.lon)).toBe(true);
    expect(esLatLonValido(91, 0)).toBe(false);
    expect(esLatLonValido(0, 181)).toBe(false);
    expect(esLatLonValido(NaN, 0)).toBe(false);
  });

  it("esPlanaColombiaAprox rechaza coordenadas de otro continente", () => {
    expect(esPlanaColombiaAprox(0, 0)).toBe(false);
  });

  it("esCartesianaValida rechaza valores fuera del radio terrestre aproximado", () => {
    expect(esCartesianaValida(8_000_000, 0, 0)).toBe(false);
  });
});
