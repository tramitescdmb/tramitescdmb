import { describe, expect, it } from "vitest";
import { csvTramites, geoJsonTramites, parseZonaParam, zonaAParam, type PuntoReporte } from "./geovisor-exportar";

const punto: PuntoReporte = {
  id: "abc123",
  numero: "M-DA-PR39-2026-0001",
  tramiteCodigo: "M-DA-PR39",
  tramiteNombre: "Permiso de Ocupación de Cauces",
  municipio: "Bucaramanga",
  estado: "EN_TRAMITE",
  solicitanteNombre: "Luis Lozano",
  fechaRadicacion: "2026-01-15T00:00:00.000Z",
  lat: 7.12,
  lon: -73.12,
};

describe("zonaAParam / parseZonaParam", () => {
  it("ida y vuelta conserva los puntos con 5 decimales", () => {
    const zona: [number, number][] = [
      [7.12345, -73.12345],
      [7.2, -73.2],
      [7.3, -73.3],
    ];
    const param = zonaAParam(zona)!;
    expect(param).toBe("7.12345,-73.12345;7.20000,-73.20000;7.30000,-73.30000");
    expect(parseZonaParam(param)).toEqual(zona);
  });

  it("devuelve null con menos de 3 puntos, y [] al parsear vacío/ausente", () => {
    expect(zonaAParam([[7, -73]])).toBeNull();
    expect(parseZonaParam(null)).toEqual([]);
    expect(parseZonaParam(undefined)).toEqual([]);
    expect(parseZonaParam("")).toEqual([]);
  });

  it("ignora pares mal formados en vez de reventar", () => {
    expect(parseZonaParam("7.1,-73.1;xx;7.2,-73.2")).toEqual([
      [7.1, -73.1],
      [7.2, -73.2],
    ]);
  });
});

describe("csvTramites", () => {
  it("incluye encabezado y una fila por punto, con el trámite y la ficha armados", () => {
    const csv = csvTramites([punto], "https://tramites.cdmb.gov.co");
    const [encabezado, fila] = csv.trim().split("\n");
    expect(encabezado).toBe("numero,tramite,solicitante,municipio,estado,fecha_radicacion,latitud,longitud,ficha");
    expect(fila).toContain("M-DA-PR39-2026-0001");
    expect(fila).toContain("M-DA-PR39 — Permiso de Ocupación de Cauces");
    expect(fila).toContain("EN TRAMITE");
    expect(fila).toContain("https://tramites.cdmb.gov.co/expedientes/abc123");
  });

  it("entrecomilla campos que traen coma", () => {
    const csv = csvTramites([{ ...punto, solicitanteNombre: "Lozano, Luis" }], "https://x");
    expect(csv).toContain('"Lozano, Luis"');
  });
});

describe("geoJsonTramites", () => {
  it("sin zona, solo trae un Feature Point por trámite", () => {
    const geojson = JSON.parse(geoJsonTramites([punto], { origen: "https://x" }));
    expect(geojson.type).toBe("FeatureCollection");
    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0].geometry).toEqual({ type: "Point", coordinates: [punto.lon, punto.lat] });
  });

  it("con zona de 3+ puntos, antepone un Feature Polygon cerrado con el área/perímetro", () => {
    const zona: [number, number][] = [
      [7.1, -73.1],
      [7.2, -73.1],
      [7.2, -73.2],
    ];
    const geojson = JSON.parse(geoJsonTramites([punto], { zona, areaM2: 1_000_000, perimetroM: 5000, origen: "https://x" }));
    expect(geojson.features).toHaveLength(2);
    const zonaFeature = geojson.features[0];
    expect(zonaFeature.properties.tipo).toBe("zona_seleccionada");
    expect(zonaFeature.properties.area_km2).toBe(1);
    expect(zonaFeature.geometry.type).toBe("Polygon");
    const anillo = zonaFeature.geometry.coordinates[0];
    expect(anillo[0]).toEqual(anillo[anillo.length - 1]);
  });
});
